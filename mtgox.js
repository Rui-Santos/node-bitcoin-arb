var https       = require('https');
var querystring = require('querystring');
var crypto      = require('crypto');

var MTGOX = module.exports = function ( key, secretkey ) {
	this.key            = key;
	this.secretkey      = secretkey;
	this.balance        = -1;
};

MTGOX.prototype.getBalance = function ( callback ){

	var self = this;

	if ( this.balance < 0 ){
		this.updateBalance( function ( balance ){
			self.balance = balance;
			callback(balance);
		});
	}else{
		callback(this.balance);
	}
};

MTGOX.prototype.updateBalance = function( callback ){

	var self = this;

	var shasum = crypto.createHmac('sha512', this.secretkey );

	var params      = { nonce : 12342342 };
	var qstring     = querystring.stringify( params );

	shasum.update( qstring );

	var options = {
		host: 'mtgox.com',
		path: '/api/0/getFunds.php',
		method: 'POST',
		headers:{
				'Rest-Key'  : this.key,
				'Rest-Sign' : shasum.digest('base64')
		}
	};

	var data = '';

	var request = https.request( options, function(res){

		res.on('data', function(chunk){
			data += chunk;
		});

		res.on('end', function(){

			console.log(data);

			return;

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

			var clean_balance = {
				USD : balance.USD,
				BTC : balance.BTC
			};

			self.storeBalance( clean_balance );

			callback(clean_balance);
		});
	});

	request.on('error', function(error){
		console.log(error);
		console.log('Getting balance failed');
	});

	request.write( qstring );
	request.end();
}

MTGOX.prototype.storeBalance = function( balance ){

	var db = require("./mysql");

	db.query(
			"UPDATE `Exchanges` SET " +
			"   `USD` = ?, BTC = ?, Dt = NOW()" +
			"WHERE" +
			"   Code = 'th'"
			, [balance.USD, balance.BTC ]);

	db.end();
}

MTGOX.prototype.getOrders = function( symbol ){

	var self = this;

	var options = {
		host: 'api.MTGOX.com',
		path: '/APIv1/'+symbol+'/Orderbook'
	};

	console.log("Getting orders for MTGOX " + symbol );

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

					console.log("Getting orders for MTGOX " + symbol + " done");

					self.updateRates( symbol );
				});
		});
	}).on('error', function(e) {
	  console.log("Got error: " + e.message);
	});

	return;
}

MTGOX.prototype.updateRates = function( symbol ){

	if ( !symbol ) return false;

	var db = require('./mysql');

	db.query("SELECT Id FROM Currencies WHERE Symbol = '"+ symbol +"'", function( err, results, fields ){

		console.log( "Updating MTGOX rates" );

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

		console.log( "Updating MTGOX rates done" );
		return;
	});

	return;
}