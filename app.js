var util = require('util');
var config = require('./config');

var TRADEHILL = require('./th');

var TRADEHILL_OBJ = new TRADEHILL( config.tradehill.password, config.tradehill.password );

TRADEHILL_OBJ.getOrders('USD');
