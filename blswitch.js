/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var blcommon = require('./lib/blcommon');

    /*
        Defines the switch node.
    */
    function SwitchOutNode(n) {
        RED.nodes.createNode(this, n);
        this.times = n.times;
        this.name = n.name;

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
        this.timer = null;
        var node = this;
        //Set init status message
        blcommon.setStatus(node, 0, "Not active");

        /* Holds messages from all different linkIds
        Sturcture of incoming messages
        { lid: xyz, status: 0/1, value:0-100, type: "rule"/"scenario"/"direct"}
        */
        node.allIds = [];
        node.activeId = "none";


        /* Method to create output message */
        //Validate function of what the output msg should look like
        node.getOutputMsg = function () {
                var ids = node.allIds;
                var id = node.id;
                var sendit = false;

                var omsg = {
                    lid: id,
                    status: 0,
                    value: 0,
                    type: "none"
                };
                for (var i = 0; i < ids.length; i++) {
                    /* precense of type: rule < scenario < direct */
                    if (ids[i].type === "direct") {
                        /* If the input is active */
                        if (ids[i].status === 1) {
                            omsg.status = 1;

                            /* Reset value if the type is changed */
                            if (omsg.type !== "direct") {
                                omsg.value = ids[i].value;
                                node.activeId = ids[i].lid;
                            }

                            //Set the active type
                            omsg.type = ids[i].type;

                            //Always use the highest value
                            if (ids[i].value > omsg.value) {
                                omsg.value = ids[i].value;
                                /*Set the active id*/
                                node.activeId = ids[i].lid;
                            }
                        }

                    } else if (ids[i].type === "scenario" && (omsg.type === "rule" || omsg.type === "none" || omsg.type === "scenario")) {
                        /* If the input is active */
                        if (ids[i].status === 1) {
                            omsg.status = 1;

                            /* Reset value if the type is changed */
                            if (omsg.type === "rule") {
                                omsg.value = ids[i].value;
                                node.activeId = ids[i].lid;
                            }

                            //Set the active type
                            omsg.type = ids[i].type;

                            //Always use the highest value
                            if (ids[i].value > omsg.value) {
                                omsg.value = ids[i].value;
                                /*Set the active id*/
                                node.activeId = ids[i].lid;
                            }
                        }

                    } else if (ids[i].type === "rule" && (omsg.type === "rule" || omsg.type === "none")) {
                        /* If the input is active */
                        if (ids[i].status === 1) {
                            omsg.status = 1;

                            //Set the active type
                            omsg.type = ids[i].type;

                            //Always use the highest value
                            if (ids[i].value > omsg.value) {
                                omsg.value = ids[i].value;
                                /*Set the active id*/
                                node.activeId = ids[i].lid;
                            }
                        }
                    }
                    if (omsg.type === "none") {
                        node.activeId = "none";
                    }
                }
                return omsg;
            } //getOutputMsg

        /* Send the message */
        node.sendMsg = function (repeatCall) {
            //Save prev id that is active
            var prevActiveId = node.activeId;

            if (node.allIds.length > 0) {
                var output = node.getOutputMsg();
                var msg = {
                    payload: output
                };

                /* Send the message the specified number of times */
                if (prevActiveId != node.activeId || repeatCall) {
                    /* Clear timer if it is not a repeatCall (called from timer) */
                    if (!repeatCall && node.timer) {
                        clearInterval(node.timer);
                    }
                    for (var i = 0; i < node.times; i++) {
                        node.send(msg);
                    }
                    /* Set timer repeat function*/
                    if (!repeatCall) {
                        node.timer = setInterval(function () {
                            node.sendMsg(true)
                        }, node.repeat);

                    }
                }

                //Set status message
                var state = 1;
                if (msg.payload === 0) {
                    state = -1;
                }
                blcommon.setStatus(node, state, output.type + "/" + output.value + "%");
            }
        }


        /* On received messages */
        node.on("input", function (msg) {
            //Validate inbound message
            var errMsg = "";
            if (msg.payload.lid == undefined) {
                errMsg += "lid is missing in msg.payload\n";
            }
            if (msg.payload.status == undefined) {
                errMsg += "status is missing in msg.payload\n";
            }
            if (msg.payload.value == undefined) {
                errMsg += "value is missing in msg.payload\n";
            }
            if (msg.payload.type == undefined) {
                errMsg += "type is missing in msg.payload\n";
            }
            if (errMsg !== "") {
                node.error(errMsg);
                return;
            }
            //Check if linkid already is in allIds array
            var lid = null;
            for (var i = 0; i < node.allIds.length; i++) {
                if (msg.payload.lid === node.allIds[i].lid) {
                    lid = i;
                    break;
                }
            }

            //Add or update entry in array
            if (lid !== null) {
                node.allIds[lid] = msg.payload;
            } else {
                node.allIds.push(msg.payload);
            }

            //Send messages
            node.sendMsg();
        });

        /* When a node is closed */
        node.on("close", function(){
            //Tidy up connections etc
            clearInterval(node.timer);
        });

    }


    RED.nodes.registerType("bl-switch out", SwitchOutNode);
};
