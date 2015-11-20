/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var blcommon = require('./lib/blcommon');


    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function RfxcomOutNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.code = config.code;

        blcommon.setStatus(node, 0, "OK");

        /* When a message is received */
        node.on("input", function(msg){
            msg.payload.lid = node.id;

            msg.topic = node.code;
            var val;
            if (msg.payload.status === 1 && msg.payload.value === 100){
                val = "On";
                blcommon.setStatus(node, 1, "On");
            } else if (msg.payload.status === 1 && msg.payload.value > 0){
                val = "level "+(msg.payload.value/100);
                blcommon.setStatus(node, 1, "On "+msg.payload.value+"%");
            } else {
                val = "Off";
                blcommon.setStatus(node, -1, "Off");
            }
            msg.payload = val;

            node.send(msg);
        });

    }
    RED.nodes.registerType("nrl-rfxcom-out", RfxcomOutNode);
};
