module.exports = function (RED) {
    "use strict";
    var common = require("../lib/common");
    require("date-utils");

    function NoreliteDelayNode(n) {
        RED.nodes.createNode(this, n);
        this.positive = n.positive;
        this.negative = n.negative;
        this.exptimeout;

        var self = this;
        common.setStatus(self);

        //Calculate timeout in millisecs
        if (n.timeoutUnits === "milliseconds") {
            self.exptimeout = n.timeout;
        } else if (n.timeoutUnits === "seconds") {
            self.exptimeout = n.timeout * 1000;
        } else if (n.timeoutUnits === "minutes") {
            self.exptimeout = n.timeout * 1000 * 60;
        } else if (n.timeoutUnits === "hours") {
            self.exptimeout = n.timeout * 1000 * 60 * 60;
        } else if (n.timeoutUnits === "days") {
            self.exptimeout = n.timeout * 1000 * 60 * 60 * 24;
        }

        self.activeMsg;
        self.queueMsg;
        self.timer;

        self.sendQueue = function(){
            //Remove timer value
            if (self.timer){
                clearTimeout(self.timer);
            }
            self.timer = undefined;

            //Assign holding msg as the active message
            self.activeMsg = self.queueMsg;
            self.send(self.activeMsg);

            //Clear status
            common.clearStatus(self);

            //Reset queue
            self.queueMsg = undefined;
        }

        /* When a message is received */
        self.on("input", function(msg){
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid){
                node.warn(validate.error);
                return;
            }

            msg.payload.lid = self.id;

            //Changing from positive to negative and it is to be hold
            if (self.activeMsg && self.activeMsg.payload.status === 1 && self.positive && !self.timer && msg.payload.status === 0){
                common.setStatus(self, 1, "On to "+new Date().addMilliseconds(self.exptimeout).toFormat("HH24:MI"));
                //Start timer On to Off
                self.timer = setTimeout(self.sendQueue, self.exptimeout);

                //Add msg to queue
                self.queueMsg = msg;

                //Send the active msg
                self.send(self.activeMsg);
                return;
            }
            //Timer has started but a new positive msg has been received
            if (self.activeMsg && self.activeMsg.payload.status === 1 && self.positive && self.timer && msg.payload.status === 1){
                //Stop timer
                clearTimeout(self.timer);
                self.timer = undefined;
                common.clearStatus(self);

                //Clear queue
                self.queueMsg = undefined;

                //Add as activeMsg
                self.activeMsg = msg;

                //Send the active msg
                self.send(self.activeMsg);
                return;
            }

            //Changing from negative to positive and it is to be hold
            if (self.activeMsg && self.activeMsg.payload.status === 0 && self.negative && !self.timer && msg.payload.status === 1){
                //Start timer On to Off
                common.setStatus(self, -1, "Off to "+new Date().addMilliseconds(self.exptimeout).toFormat("HH24:MI"));
                self.timer = setTimeout(self.sendQueue, self.exptimeout);

                //Add msg to queue
                self.queueMsg = msg;

                //Send the active msg
                self.send(self.activeMsg);
                return;
            }
            //Timer has started but a new new msg has been received
            if (self.activeMsg && self.activeMsg.payload.status === 0 && self.negative && self.timer && msg.payload.status === 0){
                //Stop timer
                clearTimeout(self.timer);
                self.timer = undefined;
                common.clearStatus(self);

                //Clear queue
                self.queueMsg = undefined;

                //Add as activeMsg
                self.activeMsg = msg;

                //Send the active msg
                self.send(self.activeMsg);
                return;
            }
            if (self.timer){
                self.queueMsg = msg;
            } else {
                common.clearStatus(self);
                self.activeMsg = msg;
                self.send(msg);
            }
        });

        //Clear timeouts
        self.on("close", function(){
            //Stop possible delay timer
            if (self.timer){
                clearTimeout(self.timer);
            }
        });
    }
    RED.nodes.registerType("nrl-hold in", NoreliteDelayNode);
}
