module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var common = require("../lib/common");

    /*******************************************
    Days limit node
    ********************************************/
    function NoreliteDaysLimitInNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.mon = config.mon;
        node.tue = config.tue;
        node.wed = config.wed;
        node.thu = config.thu;
        node.fri = config.fri;
        node.sat = config.sat;
        node.sun = config.sun;

        common.setStatus(node);

        node.on("input", function (msg) {
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid) {
                node.warn(validate.error);
                return;
            }

            msg.payload.lid = node.id;

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
                common.setStatus(node, -1, "Inactive");
            } else {
                common.setStatus(node, msg.payload.status, "Active");
            }
            node.send(msg);
        });


        node.on("close", function () {
            common.setStatus(node);
        });
    }
    RED.nodes.registerType("nrl-dayslimit in", NoreliteDaysLimitInNode);
}
