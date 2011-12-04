var util        = require('util');
var config      = require('./config');

var TRADEHILL   = require('./th');
var MTGOX       = require('./mtgox');

var TRADEHILL_OBJ = new TRADEHILL( config.tradehill.username, config.tradehill.password );
TRADEHILL_OBJ.getRates( function(balance){});

var MTGOX_OBJ = new MTGOX( config.mtgox.username, config.mtgox.password );
MTGOX_OBJ.getRates( function(balance){} );