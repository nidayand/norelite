module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("./lib/common");

    /* Configuration node */
    function NoreliteConfig(n) {
        RED.nodes.createNode(this, n);
        this.config = n.config;
        this.name = n.name;
        this.initialised = false;
    }
    RED.nodes.registerType("norelite-config", NoreliteConfig);

    NoreliteConfig.prototype.initialise = function () {
        if (this.initialised) {
            return;
        }
        this.initialised = true;

        /* Setup the emitter that will comminicate source updates
        to the evaluation nodes */
        this.emitter = new EventEmitter();
    }
    NoreliteConfig.prototype.onConfig = function (type, cb) {
        this.emitter.on(type, cb);
    }
    NoreliteConfig.prototype.emitConfig = function (type, payload) {
        this.emitter.emit(type, payload);
    }

    /* Source node */
    function NoreliteSource(n) {
        RED.nodes.createNode(this, n);
        this.configNode = RED.nodes.getNode(n.config);
        this.expire = n.expire;
        this.name = n.name;
        this.output = n.output;
        this.expire = n.expire; //It will expire after a set time
        this.expval = n.expval; //Expire value
        this.exptimer = null; //Expire timer
        var self = this;
        common.setStatus(this);

        //Initialise config
        self.configNode.initialise();

        //Calculate timeout in millisecs
        if (this.expire) {
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
        }

        self.on("input", function (msg) {

            //Send the message to emitter then send it further
            self.configNode.emitConfig(self.id, msg.payload);

            //If there is an output send the message
            if (self.output) {
                self.send(msg);
            }

            //Set status
            common.setStatus(self, 1, msg.payload);

            //Check if there is a timeout value
            if (self.expire) {
                //Clear old
                if (self.exptimer) {
                    clearTimeout(self.exptimer);
                }
                self.exptimer = setTimeout(function () {
                    self.configNode.emitConfig(self.id, self.expval);
                    if (self.output){
                        self.send({
                            payload: self.expval
                        });
                    }
                    common.setStatus(self, 1, self.expval);
                }, self.exptimeout);
            }

        });
    }
    RED.nodes.registerType("norelite-source out", NoreliteSource);

    /* Evaluation node */
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
    function NoreliteEval(n){
        RED.nodes.createNode(this, n);
        this.configNode = RED.nodes.getNode(n.config);
        this.rules = n.rules;
        this.checkall = (n.checkall === "true");
        this.timer;
        this.values = []; //Keeping all the inbound messages
        var self = this;

        //Keeps track if an input msg has been received
        self.inputreceived = false;
        self.inputsOn = n.inputson;

        //Set the base msg payload. Can be modified if the rule has an input
        self.basepayload = { lid : self.id, type: "rule", status : 1, value:100};

        //Functions to work with the values store (keeps updates from the sources)
        self.valuesAdd = function(id, val){
            var found = _.find(self.values, function(obj){return obj.id == id});
            if (found === undefined){
                self.values.push({id : id, value: val});
            }
        }
        self.valueGet = function(id){
            return _.find(self.values, function(obj){return obj.id == id});
        }

        common.setStatus(this);

        //Initialise config
        self.configNode.initialise();

        //Tidy up to ensure correct numbers in values
        for (var i=0; i<this.rules.length; i+=1) {
            var rule = this.rules[i];
            if (!isNaN(Number(rule.v))) {
                rule.v = Number(rule.v);
                rule.v2 = Number(rule.v2);
            }
        }

        //Assessment of all rules
        self.assessRules = function(){

            //Validate the rules
            var numbersTrue = 0; //Counter for number of rules that are true
            _.each(self.rules, function(rule){
                //Get the value to compare with
                var val = self.valueGet(rule.s);
                if (val != undefined){

                    //Validate the rules
                    if(operators[rule.t](val,rule.v, rule.v2)){
                        numbersTrue++;
                    }
                }
            })

            //Create the message
            var msg = {};
            msg.payload = self.basepayload;
            if (numbersTrue === self.rules.length || (numbersTrue > 0 && !self.checkAll)){
                if (!self.inputsOn){
                    msg.payload.status = 1;

                    common.setStatus(self, 1, "Active "+numbersTrue+"/"+self.rules.length);
                } else {
                    if (self.inputreceived){
                        //Don't modify the status from the incoming

                        //Show that the rule is active
                        common.setStatus(self, msg.payload.status, "Active "+numbersTrue+"/"+self.rules.length);
                    } else {
                        //Make sure that status = 0 if no new message has arrived
                        msg.payload.status = 0;

                        //Show that the rule is inactive
                        common.setStatus(self, -1, "Missing received message "+numbersTrue+"/"+self.rules.length);
                    }
                }
            } else {
                msg.payload.status = 0;
                common.setStatus(node, -1, "Inactive "+numbersTrue+"/"+self.rules.length);
            }


            /* Only send out the message if no input is used or if a new base payload has been received */
            if (!self.inputson || self.inputreceived){
                //Set the correct id
                msg.payload.lid = self.id;

                //Node does not have an input
                self.send(msg);
            }

        }

        //Add listeners for all sources
        when.promise(function(resolve, reject){
            var list = [];
            for (var i=0; i<self.rules.length; i++){
                list.push(self.rules[i].s);
            }
            if (list.length === 0){
                reject("No rules defined");
            }
            //Make the list unique
            resolve(_.uniq(list));

        }).then(function(list){
            //Setup the listener for the event to re-evaluate the rules
            _.each(list, function(id){
                self.configNode.onConfig(id, function(val){
                    //Store the value
                    self.valuesAdd(id, val);
                    self.log("Source data received: "+id+" / "+val);

                    //Initialise assessment of rules
                    self.assessRules();
                });
            });
        }, function(err){
            //Something went wrong
            self.warn(err);
        });

        /* Register a listner if the node has an input */
        if (self.inputson){
            self.on("input", function(msg){
                //Set the new basepayload to be used in this rule
                self.basepayload = msg.payload;
                self.inputreceived = true;
            });
        }

    }
    RED.nodes.registerType("norelite-eval in", NoreliteEval);
}
