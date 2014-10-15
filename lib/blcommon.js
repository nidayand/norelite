/*jslint node: true */
"use strict";
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;

module.exports = {
    /**
     * Will set the status for a node.
     * @param {Object} node  The node to set the status for
     * @param {Number} type  -1/red, 0/yellow, 1/green
     * @param {String} value The Text to be displayed
     */
    setStatus: function (node, type, value) {
        if (value !== null && value.length > 15) {
            value = value.substr(0, 15) + "...";
        }
        switch (type) {
        case -1:
            node.status({
                fill: "red",
                shape: "ring",
                text: value
            });
            break;
        case 0:
            node.status({
                fill: "yellow",
                shape: "ring",
                text: value
            });
            break;
        case 1:
            node.status({
                fill: "green",
                shape: "dot",
                text: value
            });
            break;
        }
    },

    /**
     * To set a kvb in Mongodb
     * @param {Object}   db         database connection
     * @param {String}   collection The collection to be stored under
     * @param {String}   k          Key
     * @param {String}   v          Value
     * @param {Function} callback   Callback function
     */
    setKvp: function (db, collection, k, v, callback) {
        var coll = db.collection(collection),
            query = {
                key: k
            },
            payload = {
                key: k,
                value: v
            },
            options = {
                upsert: true,
                multi: false
            };

        coll.update(query, payload, options, function (err, item) {
            if (err) {
                //node.error(err + " " + v);
                callback(null, err);
            } else {
                callback(v, err);
                //blsetStatus(node,status,v);
            }
        });
    },

    /**
     * To get a kvp from MongoDb
     * @param {Object}   db         Database conenction
     * @param {String}   collection Collection to be search
     * @param {String}   k          Key
     * @param {Function} callback   Callback function
     */
    getKvp: function (db, collection, k, callback) {
        var coll = db.collection(collection);
        /* Initiate by retreiving what is in the db */
        coll.find({
            key: k
        }, {}).toArray(function (err, items) {
            if (err) {
                //node.error(err);
                callback(null, err);
            } else {
                if (items.length > 0) {
                    callback(items[0].value);
                } else {
                    callback(null);
                }
                //blsetStatus(node,0,items[0].value);
            }
        });
    },
    /**
     * Publishes a message on the broker
     * @param {Object} config Broker configuration
     * @param {Object} client Client connection object
     * @param {String} topic  The topic string starting with "/"
     * @param {String} text   The
     */
    MqttPub: function (config, client, topic, text) {
        var msg = {};
        msg.qos = Number(0);
        msg.retain = false;
        msg.topic = config.prependtxt + topic;
        msg.payload = text;
        client.publish(msg);
    }


};
