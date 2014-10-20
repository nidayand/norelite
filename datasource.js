/*jslint node: true */
module.exports = function (RED) {
    "use strict";
    var blcommon = require('./lib/blcommon'),
        connectionPool = require('./lib/mqttConnectionPool'),
        mongo = require('mongodb'),
        MongoClient = mongo.MongoClient;

    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function DataSourceOutNode(n) {
        RED.nodes.createNode(this, n);
        this.bldb = n.bldb;
        this.dbConfig = RED.nodes.getNode(this.bldb);
        this.blbroker = n.blbroker;
        this.mqttConfig = RED.nodes.getNode(this.blbroker);
        this.mqttPre = "/ds/";
        this.expire = n.expire;
        this.blds = n.blds;
        this.dsid = RED.nodes.getNode(this.blds).dsid;

        //timeout
        if (n.timeoutUnits === "milliseconds") {
            this.exptimeout = n.timeout;
        } else if (n.timeoutUnits === "seconds") {
            this.exptimeout = n.timeout * 1000;
        } else if (n.timeoutUnits === "minutes") {
            this.exptimeout = n.timeout * 1000 * 60;
        } else if (n.timeoutUnits === "hours") {
            this.exptimeout = n.timeout * 1000 * 60 * 60;
        } else if (n.timeoutUnits === "days") {
            this.exptimeout = n.timeout * 1000 * 60 * 60 * 24;
        }
        this.expval = n.expval;
        this.exptimer = null;
        var node;
        if (this.mqttConfig) {
            node = this;
            node.clientMqtt = connectionPool.get(node.mqttConfig.broker, node.mqttConfig.port, node.mqttConfig.clientid, node.mqttConfig.username, node.mqttConfig.password);
            node.clientMqtt.on("connectionlost", function () {
                node.error("mqtt disconnected");
            });
            node.clientMqtt.on("connect", function () {
                node.log("mqtt connected");
            });
            node.clientMqtt.connect();
        } else {
            node.error("missing blbroker configuration");
        }

        if (this.dbConfig) {
            node = this;
            MongoClient.connect(this.dbConfig.url, function (err, db) {
                node.clientDb = db;
                if (err) {
                    node.error(err);
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: "disconnected"
                    });
                } else {
                    /* Initiate by retreiving what is in the db */
                    blcommon.getKvp(db, "datasource", node.dsid, function (val, err) {
                        if (!err) {
                            blcommon.setStatus(node, 0, val);
                        }
                    });


                    /* When a message is received */
                    node.on("input", function (msg) {
                        /* Check if the value has an expiration set.
                                Update the entry if not a new value has been received
                        */
                        if (node.expire) {
                            //Clear the prev expiration
                            if (node.exptimer) {
                                clearTimeout(node.exptimer);
                            }
                            //Set a new timer
                            node.exptimer = setTimeout(function () {
                                blcommon.setKvp(db, "datasource", node.dsid, node.expval, function (val, err) {
                                    if (!err) {
                                        blcommon.setStatus(node, -1, val);
                                        blcommon.MqttPub(node.mqttConfig, node.clientMqtt, node.mqttPre + node.dsid, val);
                                    }
                                });
                            }, node.exptimeout);
                        }

                        blcommon.setKvp(db, "datasource", node.dsid, msg.payload, function (val, err) {
                            if (!err) {
                                blcommon.setStatus(node, 1, val);
                                blcommon.MqttPub(node.mqttConfig, node.clientMqtt, node.mqttPre + node.dsid, val);
                            }
                        });

                    });
                }
            });
        } else {
            this.error("missing bldb configuration");
        }

        this.on("close", function () {
            if (this.clientDb) {
                this.clientDb.close();
            }
            if (this.clientMqtt) {
                this.clientMqtt.disconnect();
            }
        });
    }
    RED.nodes.registerType("datasource out", DataSourceOutNode);
};
