module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("../lib/common");

    /*******************************************
    Source node
    *******************************************/
    function NoreliteSource(n) {
        RED.nodes.createNode(this, n);
        this.configNode = RED.nodes.getNode(n.config);
        this.expire = n.expire;
        this.name = n.name;
        this.output = n.output;
        this.expire = n.expire; //It will expire after a set time
        this.expval = n.expval; //Expire value
        this.exptimer = null; //Expire timer
        this.hysteresis = n.hysteresis;
        var self = this;
        common.setStatus(this);

        //Keep a local variable for storing the last received value for hysteresis verification
        self.prevpayload = null;

        //Initialise config
        self.configNode.initialise();

        //Calculate timeout in millisecs
        if (this.expire) {
            if (n.timeoutUnits === "milliseconds") {
                this.exptimeout = n.timeout;
            } else if (n.timeoutUnits === "seconds") {
                this.exptimeout = n.timeout * 1000;
            } else if (n.timeoutUnits === "minutes") {
                this.exptimeout = n.timeout * 1000 * 60;
            } else if (n.timeoutUnits === "hours") {
                this.exptimeout = n.timeout * 1000 * 60 * 60;
            } else if (n.timeoutUnits === "days") {
                this.exptimeout = n.timeout * 1000 * 60 * 60 * 24;
            }
        }

        self.on("input", function (msg) {
            common.log(self, "Received new msg: "+JSON.stringify(msg.payload));

            // Check if outside hysteresis value only if it is larger than
            if(!isNaN(self.hysteresis) && !isNaN(msg.payload) && self.hysteresis>0){
                if(self.prevpayload !== null){
                    var diff;
                    if (self.prevpayload > msg.payload){
                        diff = self.prevpayload - msg.payload;
                    } else {
                        diff = msg.payload - self.prevpayload;
                    }

                    //If the difference is not large enough discard the message
                    if (diff < self.hysteresis){
                        //Set the node status
                        common.log(self, "Message value is less that hysteresis setting ("+self.hysteresis+"): "+self.prevpayload+ " ("+msg.payload+")");
                        common.setStatus(self, 0, self.prevpayload+ " ("+msg.payload+")");

                        return;
                    } else {
                        //Save the new value for next comparison
                        self.prevpayload = msg.payload;

                        //Set node status
                        common.setStatus(self, 1, msg.payload);
                    }

                } else {
                    //Store the received value
                    self.prevpayload = msg.payload;

                    //Set the status
                    common.setStatus(self, 1, msg.payload);
                }
            } else {
                //Set the status
                common.setStatus(self, 1, msg.payload);

                //Reset prev value
                self.prevpayload = null;
            }
            if (isNaN(self.hysteresis)){
                common.warn(self, "Hysteresis is not a number");
            }

            //Send the message to emitter then send it further
            self.configNode.emitConfig(self.id, msg.payload);

            //If there is an output send the message
            if (self.output) {
                self.send(msg);
            }

            //Check if there is a timeout value
            if (self.expire) {
                //Clear old
                if (self.exptimer) {
                    clearTimeout(self.exptimer);
                }
                self.exptimer = setTimeout(function () {
                    common.log(self, "Input value has expired");
                    self.configNode.emitConfig(self.id, self.expval);
                    if (self.output){
                        self.send({
                            payload: self.expval
                        });
                    }
                    common.setStatus(self, 1, self.expval);

                    //Reset the previous value parameter
                    self.prevpayload = null;
                }, self.exptimeout);
            }

        });

        self.on("close", function(){
           //Stop the timer
            if (self.exptimer){
                clearTimeout(self.exptimer);
            }

            //Clear the status
            common.setStatus(this);

            //Clear local variables
            self.prevpayload = null;
        });
    }
    RED.nodes.registerType("nrl-source out", NoreliteSource);
}
