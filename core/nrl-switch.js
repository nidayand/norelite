module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("../lib/common");

    /*******************************************
    Switch node and config
    *******************************************/
    function NoreliteSwitchConfig(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.times = n.times;
    }
    RED.nodes.registerType("nrl-switch-config", NoreliteSwitchConfig);
    function NoreliteSwitch(n) {
        RED.nodes.createNode(this, n);
        this.times = RED.nodes.getNode(n.times).times;
        this.name = n.name;
        this.timer = null;
        var self = this;

        //timeout
        if (n.repeatUnits === "milliseconds") {
            this.repeat = n.repeat;
        } else if (n.repeatUnits === "seconds") {
            this.repeat = n.repeat * 1000;
        } else if (n.repeatUnits === "minutes") {
            this.repeat = n.repeat * 1000 * 60;
        } else if (n.repeatUnits === "hours") {
            this.repeat = n.repeat * 1000 * 60 * 60;
        } else if (n.repeatUnits === "days") {
            this.repeat = n.repeat * 1000 * 60 * 60 * 24;
        }
        //Set init status message
        common.setStatus(self);

        /* Holds messages from all different linkIds
        Sturcture of incoming messages
        { lid: xyz, status: 0/1, value:0-100, type: "rule"/"scenario"/"direct"}
        */
        self.allIds = []; //Keeps a list of all payloads
        //Functions to work with the values store (keeps updates from the sources)
        self.allIdsAdd = function(payload){
            var found = _.findIndex(self.allIds, function(obj){return obj.lid == payload.lid});
            if (found === -1){
                self.allIds.push(payload);
            } else {
                self.allIds[found]= payload;
            }
        }
        self.allIdsGet = function(id){
            var found = _.find(self.allIds, function(obj){return obj.lid == payload.lid});
            return (found != undefined ? found : undefined);
        }
        self.activeId; //Keeps the active id of receiving message
        self.prevMsg; //Keeps store of the last sent out msg


        /* Method to create output message */
        //Validate function of what the output msg should look like
        self.getOutputMsg = function () {
                var id = self.id;
                var sendit = false;

                var out_msg = {
                    lid: id,
                    status: 0,
                    value: 0,
                    type: "none"
                };

                _.each(self.allIds, function(cid){
                    //Skip all that are not active
                    if (cid.status === 0){
                        return;
                    }

                    if (cid.type === "direct"){
                        if (cid.status){
                            out_msg.status = 1;
                        }

                        //Reset value if type is changed
                        if (out_msg.type !== "direct"){
                            out_msg.value = cid.value;
                            self.activeId = cid.lid;
                        }

                        //Set the type
                        out_msg.type = cid.type;

                        //Aways use the highest value
                        if (cid.value > out_msg.value){
                            out_msg.value = cid.value;
                            self.activeId = cid.lid;
                        }
                    }//if direct

                    else if (cid.type === "scenario" && (out_msg.type === "rule" || out_msg.type === "none" || out_msg.type === "scenario")){
                        /* If the input is active */
                        if (cid.status === 1) {
                            out_msg.status = 1;

                            /* Reset value if the type is changed */
                            if (out_msg.type !== "scenario") {
                                out_msg.value = cid.value;
                                self.activeId = cid.lid;
                            }

                            //Set the active type
                            out_msg.type = cid.type;

                            //Always use the highest value
                            if (cid.value > out_msg.value) {
                                out_msg.value = cid.value;
                                /*Set the active id*/
                                self.activeId = cid.lid;
                            }
                        }
                    }//if scenario

                    else if (cid.type === "rule" && (out_msg.type === "rule" || out_msg.type === "none")) {
                        /* If the input is active */
                        if (cid.status === 1) {
                            out_msg.status = 1;

                            //Set the active type
                            out_msg.type = cid.type;

                            //Always use the highest value
                            if (cid.value > out_msg.value) {
                                out_msg.value = cid.value;
                                /*Set the active id*/
                                self.activeId = cid.lid;
                            }
                        }
                    }//if rule
                });//each

            //If nothing has been applied set to rule
            if (out_msg.type === "none"){
                out_msg.type = "rule";
                self.activeId = "none";
            }

            return out_msg;
        } //getOutputMsg

        /* Send the message */

        self.sendMsg = function (repeatCall) {
            //Save prev id that is active
            var prevActiveId = self.activeId;

            if (self.allIds.length > 0) {
                var output = self.getOutputMsg();
                var msg = {
                    name: self.name,
                    payload: output
                };

                /* Send the message the specified number of times */
                if (prevActiveId == undefined || prevActiveId != self.activeId || repeatCall) {
                    /* Clear timer if it is not a repeatCall (called from timer) */
                    if (self.timer){
                        clearTimeout(self.timer);
                    }

                    //Check if status and value has changed from prev
                    if (self.prevMsg == undefined ||
                        (self.prevMsg.payload.status != msg.payload.status || self.prevMsg.payload.value != msg.payload.value) ||
                        repeatCall){

                        for (var i = 0; i < self.times; i++) {
                            setTimeout( function(){ self.send(msg); }, 100*(i+1));
                        }
                        //Save current message for review next time the method is called
                        self.prevMsg = msg;
                    }

                    /* Set timer repeat function*/
                    self.timer = setTimeout(function () {
                            self.sendMsg(true)
                        }, self.repeat);
                }

                //Set status message
                var state = 1;
                if (msg.payload.state === 0 || msg.payload.value === 0) {
                    state = -1;
                }
                common.setStatus(self, state, output.type + "/" + output.value + "%");
            }
        }


        /* On received messages */
        self.receiveTimeout;
        self.on("input", function (msg) {
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid){
                common.warn(self, validate.error);
                return;
            }

            //Add to local array used for validation on out message
            self.allIdsAdd(msg.payload);

            /* Set a small delay to prevent unnecessary processing before actually all messages
            have been received. E.g. when starting for the first time */
            if (self.receiveTimeout){
                clearTimeout(self.receiveTimeout);
            }
            self.receiveTimeout = setTimeout(function(){self.sendMsg();},1000);

        });

        /* When a node is closed */
        self.on("close", function(){
            //Clear the repeat timer
            if (self.timer){
                clearTimeout(self.timer);
            }
            //Clear the receive timeout
            if (self.receiveTimeout){
                clearTimeout(self.receiveTimeout);
            }
            //Reset holder of all incoming msgs and msg values
            self.allIds = [];
            self.activeId=null;
            self.prevMsg=null;

            //Reset the status
            common.setStatus(self);

        });

    }
     RED.nodes.registerType("nrl-switch out", NoreliteSwitch);
}
