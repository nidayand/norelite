/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var blcommon = require('./lib/blcommon');


    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function DaysLimitInNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.mon = config.mon;
        node.tue = config.tue;
        node.wed = config.wed;
        node.thu = config.thu;
        node.fri = config.fri;
        node.sat = config.sat;
        node.sun = config.sun;

        blcommon.setStatus(node, 0, "OK");

        node.on("input", function (msg) {
            var valid = false;
            switch (new Date().getDay()) {
            case 0:
                valid = node.sun;
                break;
            case 1:
                valid = node.mon;
                break;
            case 2:
                valid = node.tue;
                break;
            case 3:
                valid = node.wed;
                break;
            case 4:
                valid = node.thu;
                break;
            case 5:
                valid = node.fri;
                break;
            case 6:
                valid = node.sat;
                break;
            }
            if (!valid) {
                msg.payload.status = 0;
                blcommon.setStatus(node, 0, "Inactive");
            } else {
                blcommon.setStatus(node, 1, "Active");
            }
            node.send(msg);
        });
        /* When a node is closed */
        node.on("close", function () {
            //Tidy up connections etc
        });
    }
    RED.nodes.registerType("bl-dayslimit in", DaysLimitInNode);
};
