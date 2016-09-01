module.exports = function (RED) {
    "use strict";

    var common = require("../lib/common");

    function NoreliteOn(n){
        RED.nodes.createNode(this, n);
        var self = this;

        common.setStatus(self,1,"Active");

        setTimeout(function(){self.send({topic:"", payload:{lid:self.id, status:1, value:100, type:"rule"}});}, 2500);


        var timer = setInterval(function(){
            self.send({topic:"", payload:{lid:self.id, status:1, value:100, type:"rule"}});
        }, 60*1000);

        self.on("close", function(){
            clearInterval(timer);
            common.setStatus(self);
        });

    }
    RED.nodes.registerType("nrl-on in", NoreliteOn);
}
