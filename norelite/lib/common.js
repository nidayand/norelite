module.exports = {
    /**
     * Will set the status for a node.
     * @param {Object} node  The node to set the status for
     * @param {Number} type  -1/red, 0/yellow, 1/green
     * @param {String} value The Text to be displayed
     */
    setStatus: function (node, type, value) {
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
}
