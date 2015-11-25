
var validateInPayload = function(payload){
    if (typeof payload != "object") return {valid: false, error: "Not an object"};
    if (typeof payload.lid == undefined || typeof payload.status == undefined || typeof payload.value == undefined || typeof payload.type == undefined) return {valid: false, error: "Missing mandatory variables"};
    if (typeof payload.status != "number") return {valid: false, error: "Status is not a number"};
    if (typeof payload.value != "number" || !(payload.value <= 100 && payload.value >= 0) || (payload.value % 1 != 0)) return {valid: false, error:"Value is not a valid integer value between 0-100"};
    if (typeof payload.type != "string" || !(payload.type === "rule" || payload.type == "direct" || payload.type == "scenario")) return {valid: false, error:"Type is not rule/scenario/direct"};
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

module.exports = {
    setStatus: setTextStatus,
    validatePayload: validateInPayload
}
