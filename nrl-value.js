module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var common = require("./lib/common");

    /*******************************************
    Value node
    ********************************************/
    function NoreliteValueOutNode(config) {
        RED.nodes.createNode(this, config);
        this.slider = parseInt(config.slider);
        var node = this;

        /* When a message is received */
        node.on("input", function(msg){
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid){
                node.warn(validate.error);
                return;
            }

            msg.payload.lid = node.id;
            msg.payload.value = node.slider;
            node.send(msg);
        });
    }
    RED.nodes.registerType("nrl-value in", NoreliteValueOutNode);
}
