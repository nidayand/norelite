/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var common = require('../lib/common');


    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function NoreliteTellstickOutNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.code = config.code;

        common.setStatus(node);

        /* When a message is received */
        node.on("input", function(msg){
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid){
                node.warn(validate.error);
                return;
            }

            var nmsg = { device: node.code };

            var method;
            var dimlevel;
            if (msg.payload.status === 1 && msg.payload.value === 100){
                nmsg.method = "turnon";
                common.setStatus(node, 1, "On");
            } else if (msg.payload.status === 1 && msg.payload.value > 0){
                nmsg.method = "dim";
                nmsg.dimlevel = parseInt(255 * msg.payload.value/100);
                common.setStatus(node, 1, "Dim "+msg.payload.value+"%");
            } else {
                nmsg.method = "turnoff";
                common.setStatus(node, -1, "Off");
            }


            //Also passing the original instruction if
            nmsg.instruction = msg.payload;
            nmsg.instruction.lid = node.id;

            node.send(nmsg);
        });

    }
    RED.nodes.registerType("nrl-tellstick-out", NoreliteTellstickOutNode);
};
