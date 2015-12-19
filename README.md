norelite
=========
A set of [Node-Red](http://nodered.org/) nodes to ease the implementation of your home automation requirements.
![Overview example image](https://cloud.githubusercontent.com/assets/2181965/11427421/05e089e8-9463-11e5-932f-1d8b9413bfaa.jpg)

Why is norelite needed?
-----------------------
Norelite was developed to simplify the design of Node-Red flows to manage RF-controlled switches. What Norelite contributes to in comparison to using "regular" nodes is that it:

 - Keeps the history in `nrl-switch` node of all received messages. E.g. there might be many rules that decides if a switch should be on or off and the node manages on/off or dim setting based on messages received from all the parent nodes without having to re-send an instruction (a new event)
 - Using simple rules that are triggered by sources (e.g. is lamp on/off, temperature change, is the TV on) that have been updated. The rules are being re-assessed whenever there has been an update (and every minute). This makes it really simple to define complex rules or an inheritance of rules that decides if a switch should be on/off/dimmed.

Demo
----
There is an read-only, live data, demonstration environment available on IBM BlueMix: http://goo.gl/T6Ag9P if you want to take a look. Note that nodes are defined on two sheets.

Install
-------
Use npm to install norelite in the Node-RED data directory.
```bash
    cd ~/.node-red
    npm install node-red-contrib-norelite
```
Get started
-----------
The most simple flow that will turn off or on a device based on a rule:
![enter image description here](https://cloud.githubusercontent.com/assets/2181965/11564088/779f23c2-99d7-11e5-89bd-eecb46a9513b.png)

 1. Setup a set of `nrl-source` nodes that takes some input data
 2. Define a `nrl-eval` node that will evaluate some of the `nrl-source` nodes
 3. Link the `nrl-eval`to an `nrl-rfxcom` node to set the Device code and if it is dimmable
 4. Link the `nrl-rfxcom` to `nrl-limit` node to control the flow to the device node
 5. Link the `nrl-limit` node a [node-red-contrib-rfxcom](https://github.com/maxwellhadley/node-red-contrib-rfxcom) node if you are using an rfxtrx433 transceiver
 6. *Done!*
 
(if you are a Tellstick user, use the `nrl-tellstick` instead of the `nrl-rfxcom` node and the out node from [node-red-contrib-tellstick](https://github.com/emiloberg/node-red-contrib-tellstick) )

----------

Usage
-----
### nrl-source node
The source node is used to session store variables to be used in the `nrl-eval` node for assessment. When a new input is received it will alert the `nrl-eval` nodes that are using the data for evaluation in the rules.

### nrl-eval node
The evaluation node is used to evaluate a set of source nodes and if one or all (option) evaluations are true it will become active. An evaluation node can also have an input. It should however not be connected to more that one (1) parent node - if that is required, it is necessary to put an `nrl-switch` node before the child evaluation node.
The node is heavily based on the rules management in the core "switch node" that comes by default with Node-Red.

### nrl-switch node
The switch node can take **multiple inputs** and store the received messages for review based on a set of rules. Whenever a new message is received from any of the parent nodes it will create a new message based on:

 - If any (can be multiple) received parent message has status = 1 that will be an active message
 - if any message received from a parent node has a higher "value" (dim) it will be the active message
 - if any message received from a parent node has a type="scenario" that has precedence over type="rule" and type="direct" has precedence over type="scenario"

**NOTE: This is the only node that can take multiple inputs**. The node can, by an identifier in the incoming message, distinguish from where the incoming node was sent and stores all received messages within the node to make a decision on what to output. If there is a need to merge different paths just make sure that you will use this node as the "merge node" before subsequent nodes (see the example of the "Alarm is off/home" in the picture below that is just after the `nrl-switch` node)

### nrl-limit node
The nrl-limit node is used to limit the load on the node and the device and is based on the core Delay node (basic logic is all from that node but only with the functionality of a delay) but with some additional functionality. It will, whenever a new message is received, validate the current buffer of messages and if the instruction differs (e.g. turn off or dim value) from what previously have been received it will remove the first messages in the queue. This is used to avoid any unnecessary on/off actions and should be placed just before the end node that will send the actions to the hardware device. Default rate limit is 30 msg/minute and can be configured.

### nrl-dayslimit node
The dayslimit node is used to activate or inactivate a flow based on the current day of the week.

### nrl-timelimit node
The timelimit node is used to activate or inactivate a flow based on the current time

### nrl-value node
The value node is used to set a dim level.

### nrl-hold node
The nrl-hold node is used to hold an instruction for a certain amount of time if a change of action (On to Off or Off to On) is sent. E.g. if an On value (msg.payload.status = 1 and change in msg.payload.value = 1-100) that message can be hold even if an turn Off instruction is received (msg.payload.status = 0) and vice versa an Off value can be hold. An example when this can be used is if you want the lights to be still on for 5 minutes even if the rule has instructed to turn off. Dim value changes will still be let through (msg.payload.value=0-100 changes)

### nrl-rfxcom node
The rfxcom node is a node to be used with [node-red-contrib-rfxcom](https://github.com/maxwellhadley/node-red-contrib-rfxcom). It will translate the output from a nrl-switch node into a format understood by [node-red-contrib-rfxcom](https://github.com/maxwellhadley/node-red-contrib-rfxcom) who will send the instructions to the connected hardware.

### nrl-tellstick node
**NOTE: Not yet tested with a hardware device**
The tellstick node is a node to be used with [node-red-contrib-tellstick](https://github.com/emiloberg/node-red-contrib-tellstick) . It will translate the output from a nrl-switch node into a format understood by [node-red-contrib-tellstick](https://github.com/emiloberg/node-red-contrib-tellstick) who will send the instructions to the connected hardware.

Next on the to do list
-----

 - Improve the node documentation
 - Hysteresis of source values
 - Manage a source value evaluation that needs to have been "true" for a certain amount of time 
 - Support scenario nodes
 - ~~Hold value for a certain time if switching On->Off or Off->On~~
 - ~~Limit load on device node and clear buffer if new instructions are received~~

Custom nodes
------------
All nodes except for `nrl-source` expects a certain format of `msg.payload`. If any custom node is used in between norelite nodes the payload needs to have the following structure (and if it doesn't the next norelite node in the flow will not accept the message and output an warning in the log):
```javascript
    {
    	lid: "identifier",
    	status: 0/1,
    	type: "rule/scenario/direct",
    	value: 0-100
    }
```
 - lid
	 - a unique identifier that identifies the sending node. E.g. node.id
 - status
	 - 0 if the incoming message is inactive
	 - 1 if the incoming instruction is active
 - type
	 - rule = message is based on rule
	 - scenario = message is based on a scenario setting and has precedence over a rule.
		 - Not yet implemented
		 - A scenario can be used for overriding rules and implement "I want turn on or off specific switches". A scenario will (eventually) be possible to be event based.
	 - direct = message is based on a direct setting and has precedence over a scenario and rule
		 - Can be used to turn off/on specific lights and override scenario and rules
	 - value = 0 to 100 to be able to dim a light.

**NOTE: Every node within an norelite flow needs to always pass the message further. If the message is not a valid one/active just set status = 0**

A simple example of a custom node in an norelite flow using the `function` node:
```javascript
    var lid = "thisnodesuniqueid";
    if (msg.payload.value > 10){
    	msg.payload = { lid: lid, status:0, value:10, type:msg.payload.type };
    } else {
	    msg.payload = { lid: lid, status:1, value:10, type:msg.payload.type };
    }
    return msg;
```