module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("./lib/common");

    /*******************************************
    Configuration node
    ********************************************/
    function NoreliteConfig(n) {
        RED.nodes.createNode(this, n);
        this.config = n.config;
        this.name = n.name;
        this.delay = n.delay;
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

    /*******************************************
    Source node
    *******************************************/
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
                    self.log("Input value has expired");
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

    /*******************************************
    Evaluation node
    *******************************************/
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
        this.repeattimer;   //Timer for resending messages
        this.timeouttimer;  //Timer for managing a delay in send (if there are many incoming messages)
        this.values = []; //Keeping all the inbound messages
        var self = this;


        //Keeps track if an input msg has been received
        self.inputreceived = false;
        self.inputson = n.inputson;

        //Set the base msg payload. Can be modified if the rule has an input
        self.basepayload = { lid : self.id, type: "rule", status : 1, value:100};

        //Functions to work with the values store (keeps updates from the sources)
        self.valuesAdd = function(id, val){
            var found = _.findIndex(self.values, function(obj){return obj.id == id});
            if (found === -1){
                self.values.push({id : id, value: val});
            } else {
                self.values[found]= {id : id, value: val};
            }
        }
        self.valueGet = function(id){
            var found = _.find(self.values, function(obj){return obj.id == id});
            return (found != undefined ? found.value : undefined);
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
            //Copy payload (do not reference!)
            msg.payload = JSON.parse(JSON.stringify(self.basepayload));

            if (numbersTrue === self.rules.length || (numbersTrue > 0 && !self.checkall)){
                if (!self.inputson){
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
                        common.setStatus(self, -1, "Missing input "+numbersTrue+"/"+self.rules.length);
                    }
                }
            } else {
                msg.payload.status = 0;
                common.setStatus(self, -1, "Inactive "+numbersTrue+"/"+self.rules.length);
            }


            /* Only send out the message if no input is used or if a new base payload has been received */
            if (!self.inputson || self.inputreceived){
                //Set the correct id
                msg.payload.lid = self.id;

                //Send the message
                self.timeouttimer = setTimeout(function(){
                    self.send(msg);

                    //Only setup repeat for top eval node
                    if (!self.inputson){
                        self.repeattimer = setInterval(self.assessRules, 60*1000);
                    }
                }, parseInt(self.configNode.delay)*1000);

                //Setup repeat every 1min
                if (self.repeattimer){
                    clearInterval(self.repeattimer);
                }
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
                    //Stop possible delay timer
                    if (self.timeouttimer){
                        clearTimeout(self.timeouttimer);
                    }

                    //Stop the timer to avoid a new repetitive message sent before processing
                    if (self.repeattimer){
                        clearInterval(self.repeattimer);
                    }
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
                //Validate input
                var validate = common.validatePayload(msg.payload);
                if (!validate.valid){
                    self.warn(validate.error);
                    return;
                }
                //Set the new basepayload to be used in this rule
                self.basepayload = msg.payload;
                self.inputreceived = true;

                //Stop possible delay timer
                if (self.timeouttimer){
                    clearTimeout(self.timeouttimer);
                }
                //Start assessment
                self.assessRules();
            });
        }

    }
    RED.nodes.registerType("norelite-eval in", NoreliteEval);

    /*******************************************
    Switch node
    *******************************************/
    function NoreliteSwitch(n) {
        RED.nodes.createNode(this, n);
        this.times = RED.nodes.getNode(n.times).times;
        this.name = n.name;

        //timeout
        if (n.repeatUnits === "milliseconds") {
            this.repeat = n.repeat;
        } else if (n.repeatUnits === "seconds") {
            this.repeat = n.repeat * 1000;
        } else if (n.repeatUnits === "minutes") {
            this.repeat = n.repeat * 1000 * 60;
        } else if (n.repeatUnits === "hours") {
            this.repeat = n.repeat * 1000 * 60 * 60;
        } else if (n.repeatUnits === "days") {
            this.repeat = n.repeat * 1000 * 60 * 60 * 24;
        }
        this.timer = null;
        var self = this;
        //Set init status message
        common.setStatus(self);

        /* Holds messages from all different linkIds
        Sturcture of incoming messages
        { lid: xyz, status: 0/1, value:0-100, type: "rule"/"scenario"/"direct"}
        */
        self.allIds = [];
        self.activeId; //Keeps the active id of receiving message
        self.prevMsg; //Keeps store of the last sent out msg


        /* Method to create output message */
        //Validate function of what the output msg should look like
        self.getOutputMsg = function () {
                var ids = node.allIds;
                var id = node.id;
                var sendit = false;

                var omsg = {
                    lid: id,
                    status: 0,
                    value: 0,
                    type: "none"
                };
                for (var i = 0; i < ids.length; i++) {
                    /* precense of type: rule < scenario < direct */
                    if (ids[i].type === "direct") {
                        /* If the input is active */
                        if (ids[i].status === 1) {
                            omsg.status = 1;

                            /* Reset value if the type is changed */
                            if (omsg.type !== "direct") {
                                omsg.value = ids[i].value;
                                self.activeId = ids[i].lid;
                            }

                            //Set the active type
                            omsg.type = ids[i].type;

                            //Always use the highest value
                            if (ids[i].value > omsg.value) {
                                omsg.value = ids[i].value;
                                /*Set the active id*/
                                self.activeId = ids[i].lid;
                            }
                        }

                    } else if (ids[i].type === "scenario" && (omsg.type === "rule" || omsg.type === "none" || omsg.type === "scenario")) {
                        /* If the input is active */
                        if (ids[i].status === 1) {
                            omsg.status = 1;

                            /* Reset value if the type is changed */
                            if (omsg.type === "rule") {
                                omsg.value = ids[i].value;
                                self.activeId = ids[i].lid;
                            }

                            //Set the active type
                            omsg.type = ids[i].type;

                            //Always use the highest value
                            if (ids[i].value > omsg.value) {
                                omsg.value = ids[i].value;
                                /*Set the active id*/
                                self.activeId = ids[i].lid;
                            }
                        }

                    } else if (ids[i].type === "rule" && (omsg.type === "rule" || omsg.type === "none")) {
                        /* If the input is active */
                        if (ids[i].status === 1) {
                            omsg.status = 1;

                            //Set the active type
                            omsg.type = ids[i].type;

                            //Always use the highest value
                            if (ids[i].value > omsg.value) {
                                omsg.value = ids[i].value;
                                /*Set the active id*/
                                self.activeId = ids[i].lid;
                            }
                        }
                    }
                    if (omsg.type === "none") {
                        self.activeId = "none";
                    }
                }
                return omsg;
            } //getOutputMsg

        /* Send the message */

        self.sendMsg = function (repeatCall) {
            //Save prev id that is active
            var prevActiveId = self.activeId;

            if (self.allIds.length > 0) {
                var output = self.getOutputMsg();
                var msg = {
                    payload: output
                };

                /* Send the message the specified number of times */
                if (prevActiveId == undefined || prevActiveId != node.activeId || repeatCall) {
                    /* Clear timer if it is not a repeatCall (called from timer) */
                    clearTimeout(self.timer);

                    //Check if status and value has changed from prev
                    if (self.prevMsg == undefined ||
                        (self.prevMsg.payload.status != msg.payload.status || self.prevMsg.payload.value != msg.payload.value) ||
                        repeatCall){

                        for (var i = 0; i < node.times; i++) {
                            setTimeout( function(){ self.send(msg); }, 100*(i+1));
                            //node.send(msg);
                        }
                        //Save current message for review next time the method is called
                        self.prevMsg = msg;
                    }

                    /* Set timer repeat function*/
                    self.timer = setTimeout(function () {
                            self.sendMsg(true)
                        }, self.repeat);
                }

                //Set status message
                var state = 1;
                if (msg.payload.state === 0 || msg.payload.value === 0) {
                    state = -1;
                }
                common.setStatus(self, state, output.type + "/" + output.value + "%");
            }
        }


        /* On received messages */
        self.receiveTimeout;
        self.on("input", function (msg) {
            //Validate inbound message
            var errMsg = "";
            if (msg.payload.lid == undefined) {
                errMsg += "lid is missing in msg.payload\n";
            }
            if (msg.payload.status == undefined) {
                errMsg += "status is missing in msg.payload\n";
            }
            if (msg.payload.value == undefined) {
                errMsg += "value is missing in msg.payload\n";
            }
            if (msg.payload.type == undefined) {
                errMsg += "type is missing in msg.payload\n";
            }
            if (errMsg !== "") {
                self.error(errMsg);
                return;
            }
            //Check if linkid already is in allIds array
            var lid = null;
            for (var i = 0; i < self.allIds.length; i++) {
                if (msg.payload.lid === self.allIds[i].lid) {
                    lid = i;
                    break;
                }
            }

            //Add or update entry in array
            if (lid !== null) {
                self.allIds[lid] = msg.payload;
            } else {
                self.allIds.push(msg.payload);
            }

            /* Set a small delay to prevent unnecessary processing before actually all messages
            have been received. E.g. when starting for the first time */
            if (self.receiveTimeout){
                clearTimeout(self.receiveTimeout);
            }
            self.receiveTimeout = setTimeout(function(){self.sendMsg();},1000);

        });

        /* When a node is closed */
        self.on("close", function(){
            //Tidy up connections etc
            clearInterval(self.timer);
        });

    }
     RED.nodes.registerType("norelite-switch out", NoreliteSwitch);
}
