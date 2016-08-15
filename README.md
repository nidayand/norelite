norelite
=========
A set of [Node-Red](http://nodered.org/) nodes to ease the implementation of your home automation requirements.
![Overview example image](https://cloud.githubusercontent.com/assets/2181965/11427421/05e089e8-9463-11e5-932f-1d8b9413bfaa.jpg)

Install
-------
Use npm to install norelite in the Node-RED data directory.
```bash
    cd ~/.node-red
    npm install norelite
```

Why is norelite needed?
-----------------------
Norelite was developed to simplify the design of Node-Red flows to manage RF-controlled switches. What Norelite contributes to in comparison to using "regular" nodes is that it:
* It is primarily based on rules that if true triggers an "turn on" action and if false it will trigger an "turn off" action.
* It will keep the state (actions received) and will re-evaluate if a device should be on and off depeding on the messages received. Many rules can decide whether or not a a device should be active e.g. (1) if it is dark outside (2) if I'm at home and it is dark and passed midnight and there is movement in the house
* **ONE flow will send ON and OFF messages**. You don't have to develop a separate flow to manage off actions and take into consideration any colliding rules
* It is simple!

Supported devices
-----------------
* Tellstick - through [node-red-contrib-tellstick](https://www.npmjs.com/package/node-red-contrib-tellstick)
* Rfxcom - through [node-red-contrib-rfxcom](https://www.npmjs.com/package/node-red-contrib-rfxcom)
* Z-Wave - through [node-red-contrib-openzwave](https://www.npmjs.com/package/node-red-contrib-openzwave)

Documentation
--------------------
The documentation is located in the [Github wiki](https://github.com/nidayand/norelite/wiki) including some getting started information.

How does it work?
-----------------
It is briefly explained in the picture below (even if not all types of nodes are represented).
![Overview example image](https://cloud.githubusercontent.com/assets/2181965/17513447/57803b6a-5e2d-11e6-91a7-2a2b270c7c02.png)

Demo
----
There is an read-only, live data, demonstration environment available on IBM BlueMix: http://goo.gl/T6Ag9P if you want to take a look. Note that nodes are defined on two sheets.

