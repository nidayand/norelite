module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var common = require("./lib/common");

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
            if (!validate.valid){
                node.warn(validate.error);
                return;
            }

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
    }
    RED.nodes.registerType("nrl-dayslimit in", NoreliteDaysLimitInNode);

    /*******************************************
    Time limit node
    ********************************************/
    function NoreliteTimeLimitInNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.from = config.from;
        node.to = config.to;

        /* Validate if node is ok. Copied validation
        from HTML-file */
        var validate = function (v) {
            if (v.indexOf(":") == -1) {
                return false;
            }
            var tarr = v.split(":");
            if (tarr.length != 2) {
                return false;
            }
            var h = parseInt(tarr[0]);
            if (isNaN(h) || h < 0 || h > 23) {
                return false;
            }
            var m = parseInt(tarr[1]);
            if (isNaN(m) || m < 0 || m > 59) {
                return false;
            }
            return true;
        };

        var getTimeObject = function (v) {
            var tarr = v.split(":");
            return {
                hours: parseInt(tarr[0]),
                mins: parseInt(tarr[1]),
                totSecs: (parseInt(tarr[0]) * 3600 + parseInt(tarr[1]) * 60)
            };
        }

        //Are both valid?
        node.valid = validate(node.from) && validate(node.to);

        if (!node.valid) {
            if (!validate(node.from)) {
                node.warn("FROM field (time limit) has an invalid entry");
            }
            if (!validate(node.to)) {
                node.warn("TO field (time limit) has an invalid entry");
            }
            common.setStatus(node, -1, "Invalid defintion");
            node.error("Cannot proceed due to invalid input");
        }
        common.setStatus(node);

        /* Get the hours and minutes */
        node.from = getTimeObject(node.from);
        node.to = getTimeObject(node.to);

        /* When a message is received */
        node.on("input", function (msg) {
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid){
                node.warn(validate.error);
                return;
            }

            msg.payload.lid = node.id;

            var now = new Date();
            var nowTotSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            if (node.from.totSecs < node.to.totSecs) {
                //From < To (both on same day)

                if (node.from.totSecs < nowTotSecs && nowTotSecs < node.to.totSecs) {
                    //Never set. Only reset
                    common.setStatus(node, msg.payload.status, "Active");
                } else {
                    msg.payload.status = 0;
                    common.setStatus(node, -1, "Inactive");
                }

            } else {

                if ((node.from.totSecs < nowTotSecs) || nowTotSecs < node.to.totSecs) {
                    //Never set. Only reset
                    common.setStatus(node, msg.payload.status, "Active");
                } else {
                    msg.payload.status = 0;
                    common.setStatus(node, -1, "Inactive");
                }

            }

            node.send(msg);
        });
    }
    RED.nodes.registerType("nrl-timelimit in", NoreliteTimeLimitInNode);


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
