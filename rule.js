module.exports = function (RED) {
    "use strict";
    var blcommon = require('./lib/blcommon');
    var connectionPool = require('./lib/mqttConnectionPool');
    var mongo = require('mongodb');
    var MongoClient = mongo.MongoClient;

    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function RuleInNode(n) {
        RED.nodes.createNode(this, n);

    }
    RED.nodes.registerType("rule in", RuleInNode);
}
