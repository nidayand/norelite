module.exports = function (RED) {
    "use strict";

    var when = require('when');
    var _ = require('underscore');
    var EventEmitter = require('events').EventEmitter;
    var common = require("../lib/common");

    /*******************************************
    Configuration node
    ********************************************/
    function NoreliteConfig(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.delay = n.delay;
        this.initialised = false;
    }
    RED.nodes.registerType("nrl-config", NoreliteConfig);

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
}
