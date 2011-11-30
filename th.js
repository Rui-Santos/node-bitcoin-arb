var https       = require('https');
var querystring = require('querystring');

var TRADEHILL = module.exports = function ( username, password) {
	this.username   = username;
	this.password   = password;
	this.balance    = -1;
};

TRADEHILL.prototype.getBalance = function (){

	if ( this.balance < 0 ){
		this.updateBalance();
	}

    return this.balance;
};

TRADEHILL.prototype.updateBalance = function(){

	var self = this;

	var params = querystring.stringify({ name:this.username, pass:this.password });

	var options = {
		host: 'api.tradehill.com',
		path: '/APIv1/USD/GetBalance',
		method: 'POST',
		headers:{
				'Content-Length': params.length
		}
	};

	var data = '';

	var request = https.request( options, function(res){

		res.on('data', function(chunk){
			data += chunk;
		});

		res.on('end', function(){

			var balance;

			try {
			  balance = JSON.parse(data);
			}
			catch (err) {
				console.error('JSON conversion from data incorrect');
				console.error(data);
				return;
			}

			if ( balance.error ){
				console.error("Error returned - " + balance.error);
				return;
			}

			self.storeBalance( balance );
		});
	});

	request.on('error', function(error){
		console.log(error);
		console.log('Getting balance failed');
	});

	request.write( params );
	request.end();
}

TRADEHILL.prototype.storeBalance = function( balance ){

	var db = require("./mysql");

	db.query(
			"UPDATE `Exchanges` SET " +
			"   `USD` = ?, BTC = ?, Dt = NOW()" +
			"WHERE" +
			"   Code = 'th'"
			, [balance.USD, balance.BTC ]);

	db.end();

	return;
}

TRADEHILL.prototype.getOrders = function( symbol ){

	var self = this;

	var options = {
		host: 'api.tradehill.com',
		path: '/APIv1/'+symbol+'/Orderbook'
	};

	console.log("Getting orders for TradeHill " + symbol );

	https.get( options, function(res) {

		var data = '';

		res.on('data', function(chunk){
			data += chunk;
		});

		res.on('end', function(){

			var orders;

			try {
			  orders = JSON.parse(data);
			}
			catch (err) {
				console.error('JSON conversion from data incorrect');
				console.error(data);
				return;
			}

			if ( orders.error ){
				console.error("Error returned - " + orders.error);
				return;
			}

			var db = require('./mysql');

			db.query("DELETE FROM Orders WHERE Exchanges_Id = 2 AND Currencies_Id = (" +
				"SELECT Id FROM Currencies WHERE Symbol = ?" +
				")", [symbol], function(){
					orders.bids.forEach(function(data){
						db.query("INSERT INTO Orders( " +
								"Exchanges_Id, Currencies_Id, Dt, BidAsk, Price, Amount" +
								")" +
								"SELECT" +
								"   2, Id, NOW(), 'bid', " + data[0] + ", " + data[1] +
								" FROM Currencies WHERE Symbol = ?", [symbol] );
					});

					orders.asks.forEach(function(data){
						db.query("INSERT INTO Orders( " +
								"Exchanges_Id, Currencies_Id, Dt, BidAsk, Price, Amount" +
								")" +
								"SELECT" +
								"   2, Id, NOW(), 'ask', " + data[0] + ", " + data[1] +
								" FROM Currencies WHERE Symbol = ?", [symbol] );
					});

					console.log("Getting orders for TradeHill " + symbol + " done");

					self.updateRates( symbol );
					return;
				});
		});
	}).on('error', function(e) {
	  console.log("Got error: " + e.message);
	});

	return;
}

TRADEHILL.prototype.updateRates = function( symbol ){

	if ( !symbol ) return false;

	var db = require('./mysql');

	db.query("SELECT Id FROM Currencies WHERE Symbol = '"+ symbol +"'", function( err, results, fields ){

		console.log( "Updating TradeHill rates" );

		var symbol_id = results[0].Id;

		db.query("UPDATE `Rates` SET" +
				" Bid = (" +
				"   SELECT MAX(Price) FROM `Orders` WHERE BidAsk = 'bid' and Exchanges_Id = 2 AND Currencies_Id = " + symbol_id +
				") " +
				"WHERE " +
				"Exchanges_Id = 2 AND Currencies_Id = " + symbol_id );

		var sql = "UPDATE `Rates` SET" +
				" Ask = (" +
				"   SELECT MIN(Price) FROM `Orders` WHERE BidAsk = 'ask' AND Exchanges_Id = 2 AND Currencies_Id = " + symbol_id +
				") " +
				"WHERE " +
				"Exchanges_Id = 2 AND Currencies_Id = " + symbol_id;

		db.query(sql);

		console.log( "Updating TradeHill rates done" );
		return;
	});

	return;
}