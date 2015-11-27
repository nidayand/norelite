module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("./lib/common");

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
        var self = this;
        common.setStatus(this);

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
            self.log("Received new msg: "+JSON.stringify(msg.payload));

            //Send the message to emitter then send it further
            self.configNode.emitConfig(self.id, msg.payload);

            //If there is an output send the message
            if (self.output) {
                self.send(msg);
            }

            //Set status
            common.setStatus(self, 1, msg.payload);

            //Check if there is a timeout value
            if (self.expire) {
                //Clear old
                if (self.exptimer) {
                    clearTimeout(self.exptimer);
                }
                self.exptimer = setTimeout(function () {
                    self.log("Input value has expired");
                    self.configNode.emitConfig(self.id, self.expval);
                    if (self.output){
                        self.send({
                            payload: self.expval
                        });
                    }
                    common.setStatus(self, 1, self.expval);
                }, self.exptimeout);
            }

        });
    }
    RED.nodes.registerType("nrl-source out", NoreliteSource);
}
