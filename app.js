var util = require('util');
var config = require('./config');

var TRADEHILL   = require('./th');
var MTGOX       = require('./mtgox');

//var TRADEHILL_OBJ = new TRADEHILL( config.tradehill.username, config.tradehill.password );
//TRADEHILL_OBJ.getBalance( function(balance){ console.log(balance); } );

var MTGOX_OBJ = new MTGOX( config.mtgox.key, config.mtgox.secretkey );
MTGOX_OBJ.getBalance( function(balance){ console.log(balance); } );

