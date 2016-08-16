/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var common = require('../lib/common');


    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function NoreliteZwaveOutNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.code = config.code;
        node.dimmable = config.dimmable;

        common.setStatus(node);

        /* When a message is received */
        node.on("input", function (msg) {
            //Validate input
            var validate = common.validatePayload(msg.payload);
            if (!validate.valid) {
                node.warn(validate.error);
                return;
            }

            var nmsg = {
            };

            var method;
            var dimlevel;
            if (node.dimmable) {
                if (msg.payload.status === 1 && msg.payload.value > 0) {
                    //{topic: 'setLevel', payload: {"nodeid": 5, "value": 50}}
                    nmsg = {topic: 'setLevel', payload: {"nodeid": node.code, "value": msg.payload.value}};
                    common.setStatus(node, 1, "Dim " + msg.payload.value + "%");
                } else {
                    //{topic: 'switchOff', payload: {"nodeid":2}}
                    nmsg = {topic: 'switchOff', payload: {"nodeid":node.code}};
                    common.setStatus(node, -1, "Off");
                }
            } else {
                if (msg.payload.status === 1 && msg.payload.value > 0) {
                    //{topic: 'switchOn', payload: {"nodeid":2}}
                    nmsg = {topic: 'switchOn', payload: {"nodeid":node.code}};
                    common.setStatus(node, 1, "On");
                } else {
                    //{topic: 'switchOff', payload: {"nodeid":2}}
                    nmsg = {topic: 'switchOff', payload: {"nodeid":node.code}};
                    common.setStatus(node, -1, "Off");
                }
            }


            //Also passing the original instruction if
            nmsg.instruction = msg.payload;
            nmsg.instruction.lid = node.id;

            node.send(nmsg);
        });

    }
    RED.nodes.registerType("nrl-zwave-out", NoreliteZwaveOutNode);

    /* Create an API to retrieve the nodes information
    According to https://github.com/OpenZWave/node-red-contrib-openzwave/blob/master/10-zwave.js it is stored in a global variable named openzwaveNodes */
    RED.httpAdmin.get('/norelite/nrl-zwave/getzwavenodes', function(req,res){
        if (RED.settings.functionGlobalContext.openzwaveNodes){
            res.send(JSON.stringify(RED.settings.functionGlobalContext.openzwaveNodes));
        } else {
            res.send(JSON.stringify({}));
        }
    });
};
