module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("../lib/common");

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
        this.outputdelay = n.outputdelay;
        this.name = n.name;
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
                        self.log("Rule ("+self.name+") is TRUE: "+val+" "+rule.t+" "+rule.v);
                    } else {
                        self.log("Rule ("+self.name+") is FALSE: "+val+" "+rule.t+" "+rule.v);
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

                //Set the name
                msg.name = self.name;

                //Send the message
                self.timeouttimer = setTimeout(function(){
                    self.send(msg);

                    //Only setup repeat for top eval node
                    if (!self.inputson){
                        self.repeattimer = setInterval(self.assessRules, 60*1000);
                    }
                }, self.outputdelay ? 0 : (parseInt(self.configNode.delay)*1000));

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

        //Clear timeouts
        self.on("close", function(){
            //Stop possible delay timer
            if (self.timeouttimer){
                clearTimeout(self.timeouttimer);
            }

            //Stop the timer to avoid a new repetitive message sent before processing
            if (self.repeattimer){
                clearInterval(self.repeattimer);
            }
        });

    }
    RED.nodes.registerType("nrl-eval in", NoreliteEval);
}
