module.exports = function(RED) {
    "use strict";
    var mongo = require('mongodb');
    var MongoClient = mongo.MongoClient;
    
    /**
    Will set the status for a node.
    type:
        -1 : red
        0 : yellow
        1 : green
    value : text to be displayed
    */
    var blsetStatus = function(node, type, value){
        if(value!= null && value.length>15)
            value=value.substr(0,15)+"...";
        switch(type){
                case -1: node.status({fill:"red",shape:"ring",text: value});
                    break;
                case 0: node.status({fill:"yellow",shape:"ring",text: value});
                    break;
                case 1: node.status({fill:"green",shape:"dot",text: value});
                    break;
        }
    }
    
    /**
    To set a kvp in Mongodb
    db : database connection
    collection: the collection to be stored under in string. E.g. "datasource"
    k : key
    v : value
    callback : function to retrieve the return value and possible error function(val, err)
    **/
    var blsetKvp = function(db, collection, k, v, callback){
        var coll = db.collection(collection);
        var query = { key: k };
        var payload = { key: k, value: v};
        var options = {
            upsert: true,
            multi: false
        };

        coll.update(query, payload, options, function(err, item) {
            if (err) {
                //node.error(err + " " + v);
                callback(null, err);
            } else {
                callback(v,err);
                //blsetStatus(node,status,v);
            }
        });          
    }
    /**
    To get a kvp in Mongodb
    db : database connection
    collection: the collection to be stored under in string. E.g. "datasource"
    k : key
    callback : function to retrieve the return value and possible error function(val, err)
    **/
    var blgetKvp = function(db, collection, k, callback){
        var coll = db.collection(collection);
        /* Initiate by retreiving what is in the db */
        coll.find({ key: k },{}).toArray(function(err, items) {
                    if (err) {
                        //node.error(err);
                        callback(null, err);
                    } else {
                        if (items.length>0)
                            callback(items[0].value);
                        else
                            callback(null);
                        //blsetStatus(node,0,items[0].value); 
                    }
                });          
    }
    var blMqttPub = function(config, client, topic,text){
        //var client = connectionPool.get(brokerConfig.broker,brokerConfig.port,brokerConfig.clientid,brokerConfig.username,brokerConfig.password);
        var msg = {};
        msg.qos = Number(0);
        msg.retain = false;
        msg.topic = config.prependtxt + topic;
        msg.payload = text;
        client.publish(msg);
    }
    
    /*
        Set the configuration node for MQTT
        Information is copied from the 10-mqtt.js
    */
    
    var connectionPool = require("./lib/mqttConnectionPool");

    function MQTTBrokerNode(n) {
        RED.nodes.createNode(this,n);
        this.broker = n.broker;
        this.port = n.port;
        this.prependtxt = n.prependtxt;
        this.clientid = n.clientid;
        if (this.credentials) {
            this.username = this.credentials.user;
            this.password = this.credentials.password;
        }
    }
    RED.nodes.registerType("blbroker",MQTTBrokerNode,{
        credentials: {
            user: {type:"text"},
            password: {type: "password"}
        }
    });    
    
    /*
        Set the configuration node for mongodb.
        Information is copied from the 66-mongodb.js
    */
    function BelightNode(n) {
        RED.nodes.createNode(this,n);
        this.hostname = n.hostname;
        this.port = n.port;
        this.db = n.db;
        this.name = n.name;

        var url = "mongodb://";
        if (this.credentials && this.credentials.user && this.credentials.password) {
            url += this.credentials.user+":"+this.credentials.password+"@";
        }
        url += this.hostname+":"+this.port+"/"+this.db;

        this.url = url;
    }

    RED.nodes.registerType("bldb",BelightNode,{
        credentials: {
            user: {type:"text"},
            password: {type: "password"}
        }
    });
    
    /*
        Defines the output node for a rule. Copied to a large extent from 66-mongodb.js
    */
    function DataSourceOutNode(n) {
        RED.nodes.createNode(this,n);
        this.bldb = n.bldb;
        this.dbConfig = RED.nodes.getNode(this.bldb);
        this.blbroker = n.blbroker;
        this.mqttConfig = RED.nodes.getNode(this.blbroker);
        this.mqttPre = "/ds/";
        this.expire = n.expire;
        //timeout 
        if (n.timeoutUnits == "milliseconds") {
            this.exptimeout= n.timeout;
        } else if (n.timeoutUnits == "seconds") {
            this.exptimeout= n.timeout * 1000;
        } else if (n.timeoutUnits == "minutes") {
            this.exptimeout= n.timeout * 1000*60;
        } else if (n.timeoutUnits == "hours") {
            this.exptimeout= n.timeout * 1000*60*60;
        } else if (n.timeoutUnits == "days") {
            this.exptimeout= n.timeout * 1000*60*60*24;
        }   
        this.expval = n.expval;
        this.exptimer = null;
        var node;
        if (this.mqttConfig){
            node = this;
            node.clientMqtt = connectionPool.get(node.mqttConfig.broker,node.mqttConfig.port,node.mqttConfig.clientid,node.mqttConfig.username,node.mqttConfig.password);
            node.clientMqtt.on("connectionlost",function() {
                node.error("mqtt disconnected");
            });
            node.clientMqtt.on("connect",function() {
                node.log("mqtt connected");
            });            
            node.clientMqtt.connect();
        } else {
            node.error("missing blbroker configuration");
        }

        if (this.dbConfig) {
            node = this;
            MongoClient.connect(this.dbConfig.url, function(err, db) {
                node.clientDb = db;
                if (err) {
                    node.error(err);
					node.status({fill:"red",shape:"ring",text:"disconnected"});
                } else {
                    /* Initiate by retreiving what is in the db */
                    blgetKvp(db, "datasource", node.name, function(val,err){
                         if(!err)
                             blsetStatus(node,0,val)
                     });
                       

                    /* When a message is received */
                    node.on("input",function(msg) {
                        /* Check if the value has an expiration set.
                                Update the entry if not a new value has been received
                        */
                        if(node.expire){
                            //Clear the prev expiration
                            if (node.exptimer)
                                clearTimeout(node.exptimer);
                            //Set a new timer
                            node.exptimer = setTimeout(function(){
                                 blsetKvp(db, "datasource", node.name, node.expval, function(val,err){
                                     if(!err){
                                         blsetStatus(node,-1,val);
                                         blMqttPub(node.mqttConfig, node.clientMqtt, node.mqttPre+node.name, val);
                                     }
                                 });
                            },node.exptimeout);
                        }
                        
                        blsetKvp(db, "datasource", node.name, msg.payload, function(val,err){
                             if(!err){
                                 blsetStatus(node,1,val);
                                 blMqttPub(node.mqttConfig, node.clientMqtt, node.mqttPre+node.name, val);
                             }
                         });

                    });
                }
            });
        } else {
            this.error("missing bldb configuration");
        }

        this.on("close", function() {
            if (this.clientDb) {
                this.clientDb.close();
            }
            if (this.clientMqtt) {
                this.clientMqtt.disconnect();
            }            
        });
    }
    RED.nodes.registerType("datasource out",DataSourceOutNode);    
}