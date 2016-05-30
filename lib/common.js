var config = require("../config");

var validateInPayload = function(payload){
    var txt = "Invalid input msg.payload: "
    if (typeof payload != "object") return {valid: false, error: txt+"Not an object: ("+JSON.stringify(payload)+")" };
    if (typeof payload.lid == undefined || typeof payload.status == undefined || typeof payload.value == undefined || typeof payload.type == undefined) return {valid: false, error: txt+"Missing mandatory variables: ("+JSON.stringify(payload)+")"};
    if (typeof payload.status != "number") return {valid: false, error: txt+"Status is not a number: ("+JSON.stringify(payload)+")"};
    if (typeof payload.value != "number" || !(payload.value <= 100 && payload.value >= 0) || (payload.value % 1 != 0)) return {valid: false, error:txt+"Value is not a valid integer value between 0-100: ("+JSON.stringify(payload)+")"};
    if (typeof payload.type != "string" || !(payload.type === "rule" || payload.type == "direct" || payload.type == "scenario")) return {valid: false, error:txt+"Type is not rule/scenario/direct: ("+JSON.stringify(payload)+")"};
    return {valid: true, error: undefined};
}

/**
 * Will set the status for a node.
 * @param {Object} node  The node to set the status for
 * @param {Number} type  -1/red, 0/yellow, 1/green
 * @param {String} value The Text to be displayed
 */
var setTextStatus = function (node, type, value) {
        if (type == undefined){
            value="Initializing";
            type = 0;
        }

        if (typeof value == "boolean"){
            value = value.toString();
        } else if (typeof value == "number"){
            value = value.toString();
        }
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
}
var removeTextStatus = function(node){
    node.status({});
}

var log = function(node, text){
    if (config.log){
        node.log(text);
    }
}
var warn = function(node, text){
     node.warn(text);
}
var error = function(node, text){
    node.error(text);
}

module.exports = {
    setStatus: setTextStatus,
    clearStatus : removeTextStatus,
    validatePayload: validateInPayload,
    log : log,
    warn : warn,
    error : error
}
