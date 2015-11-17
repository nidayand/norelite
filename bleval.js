module.exports = function(RED) {
    "use strict";
    var blcommon = require('./lib/blcommon'),
        connectionPool = require('./lib/mqttConnectionPool'),
        mongo = require('mongodb'),
        MongoClient = mongo.MongoClient;
    var operators = {
        'eq': function(a, b) { return a == b; },
        'neq': function(a, b) { return a != b; },
        'lt': function(a, b) { return a < b; },
        'lte': function(a, b) { return a <= b; },
        'gt': function(a, b) { return a > b; },
        'gte': function(a, b) { return a >= b; },
        'btwn': function(a, b, c) { return a >= b && a <= c; },
        'cont': function(a, b) { return (a + "").indexOf(b) != -1; },
        'regex': function(a, b) { return (a + "").match(new RegExp(b)); },
        'true': function(a) { return a === true; },
        'false': function(a) { return a === false; },
        'null': function(a) { return typeof a == "undefined"; },
        'nnull': function(a) { return typeof a != "undefined"; }
    };

    function blevalNode(n) {
        RED.nodes.createNode(this, n);
        this.bldb = n.bldb;
        this.dbConfig = RED.nodes.getNode(this.bldb);
        this.blbroker = n.blbroker;
        this.mqttConfig = RED.nodes.getNode(this.blbroker);
        this.mqttPre = "/source/";
        this.rules = n.rules;
        this.checkall = (n.checkall === "true");
        this.timer;
        var node = this;

        //Tidy up to ensure correct numbers in values
        for (var i=0; i<this.rules.length; i+=1) {
            var rule = this.rules[i];
            if (!isNaN(Number(rule.v))) {
                rule.v = Number(rule.v);
                rule.v2 = Number(rule.v2);
            }
        }

        //Connect to broker
        if (this.mqttConfig) {
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
            blcommon.setStatus(node, -1, "Missing blbroker configuration");
        }

        /**/
        node.assess = function(res){

            var numbersTrue = 0;
            for (var i=0; i<node.rules.length; i+=1) {
                var rule = node.rules[i];

                //Get the value from the db response
                var test;
                for (var j=0; j<res.length; j++){
                    if (res[j].id == rule.s){
                        test = res[j].val;
                        break;
                    }
                }

                //Validate
                if (operators[rule.t](test,rule.v, rule.v2)) {
                    numbersTrue++;
                    if (!node.checkall) { break; }
                } else {
                    if (node.checkall) { break; }
                }
            }

            var msg = {};
            msg.payload = { lid : node.id, type: "rule", status : 1, value:100};
            if ((node.checkall && numbersTrue === node.rules.length) || (!node.checkall && (numbersTrue>0))){
                msg.payload.status = 1;
                blcommon.setStatus(node, 1, "Active");
            } else {
                msg.payload.status = 0;
                blcommon.setStatus(node, 0, "Not active");
            }
            node.send(msg);
        }

        if (this.dbConfig) {
            //Connect to db
            MongoClient.connect(this.dbConfig.url, function (err, db) {
                node.clientDb = db;
                if (err) {
                    node.error(err);
                    blcommon.setStatus(node, -1, "Store disconnected");
                } else {
                    //Connection to db successful
                    blcommon.setStatus(node, 0, "Connected");

                    var initiateAssessment = function(){
                            //Go through all sources and validate
                            var res = [];
                            for(var j=0; j<node.rules.length; j+=1){
                                //var id_t = node.rules[j].s;
                                var getVal = function(id_t){
                                    blcommon.getKvp(db,"source",id_t , function(val,err){
                                        res.push({id:id_t, val:val, error: !err?false:true});

                                        //Continue if all db info has been received
                                        if(res.length==node.rules.length){
                                            //Start timer (only called once)
                                            if (!node.timer){
                                                node.timer = setInterval(initiateAssessment, 60*1000);
                                            }

                                            //Send for evaluation
                                            node.assess(res);
                                        }
                                    });
                                }
                                getVal(node.rules[j].s);

                            }
                    }

                    //Add listeners to the MQTT-messages
                    for (var i=0; i<node.rules.length; i+=1) {
                        blcommon.MqttSub(node.mqttConfig, node.clientMqtt, node.mqttPre+node.rules[i].s, function(topic,payload,qos,retain){
                            initiateAssessment();
                        });
                    }

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
            if (this.timer){
                clearInterval(this.timer);
            }
        });

    }
    RED.nodes.registerType("bl-eval in", blevalNode);
}
