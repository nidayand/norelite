/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var blcommon = require('./lib/blcommon');


    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function TimeLimitInNode(config) {
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
            blcommon.setStatus(node, -1, "Invalid defintion");
            node.error("Cannot proceed due to invalid input");
        }
        blcommon.setStatus(node, 0, "OK defintion");

        /* Get the hours and minutes */
        node.from = getTimeObject(node.from);
        node.to = getTimeObject(node.to);

        /* When a message is received */
        node.on("input", function (msg) {
            msg.payload.lid = node.id;

            var now = new Date();
            var nowTotSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            if (node.from.totSecs < node.to.totSecs) {
                //From < To (both on same day)

                if (node.from.totSecs < nowTotSecs && nowTotSecs < node.to.totSecs) {
                    //Never set. Only reset
                    blcommon.setStatus(node, 1, "Active");
                } else {
                    msg.payload.status = 0;
                    blcommon.setStatus(node, 0, "Inactive");
                }

            } else {

                if ((node.from.totSecs < nowTotSecs) || nowTotSecs < node.to.totSecs) {
                    //Never set. Only reset
                    blcommon.setStatus(node, 1, "Active");
                } else {
                    msg.payload.status = 0;
                    blcommon.setStatus(node, 0, "Inactive");
                }

            }

            node.send(msg);
        });

        /* When a node is closed */
        node.on("close", function () {
            //Tidy up connections etc
        });
    }
    RED.nodes.registerType("nrl-timelimit in", TimeLimitInNode);
};
