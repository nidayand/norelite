/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var common = require('./lib/common');


    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function NoreliteRfxcomOutNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.code = config.code;

        common.setStatus(node);

        /* When a message is received */
        node.on("input", function(msg){
            var nmsg = {};
            nmsg.topic = node.code;

            var val;
            if (msg.payload.status === 1 && msg.payload.value === 100){
                val = "On";
                common.setStatus(node, 1, "On");
            } else if (msg.payload.status === 1 && msg.payload.value > 0){
                val = "level "+(msg.payload.value/100);
                common.setStatus(node, 1, "On "+msg.payload.value+"%");
            } else {
                val = "Off";
                common.setStatus(node, -1, "Off");
            }
            nmsg.payload = val;

            node.send(nmsg);
        });

    }
    RED.nodes.registerType("nrl-rfxcom-out", NoreliteRfxcomOutNode);
};
