var db = require("./mysql");

var TRADEHILL = module.exports = function ( key, secret ) {

	var get_http_options = {
                        host    : 'api.tradehill.com',
                        method  : 'GET',
						headers : {
									'User-Agent'    : 'btb'
								}
                        };

	var post_http_options = {
                        host    : 'api.tradehill.com',
                        method  : 'POST',
						headers : {
									'User-Agent'    : 'btb',
									'Accept'        : 'application/json',
									'Content-Type'  : 'application/x-www-form-urlencoded'
								}
                        };

	var logger = function( err, throw_exception ){

		var time = new Date();

		console.error( time.toUTCString() + " - TradeHill - " + err.message );

		if ( throw_exception ){
			throw err;
		}
	}

	var update_orders = function( orders, callback ){

		var order_ids = [];

		var orders_sql = '';

		orders.forEach(function(order){

			console.log(order);

			var buysell = order.type == 1 ? 'sell' : 'buy';

			orders_sql = "INSERT DELAYED INTO " +
					"Orders( Exchanges_Id, Currencies_Id, OID, Status, BuySell, Dt, Amount, Price ) " +
					"SELECT 2, Id, ? , ? , ? , FROM_UNIXTIME(?), ?, ? " +
					"FROM Currencies WHERE Symbol = ? " +
					"ON DUPLICATE KEY UPDATE " +
					"   Status = VALUES(Status)";

			db.query( orders_sql, [ order.oid, order.status, buysell, order.date, order.amount, order.price, order.reserved_currency] );

			order_ids.push(order.oid);

			// TODO fix reserved currency
		});

		var not_in_delete_oids = order_ids.join("','");

		db.query("DELETE FROM Orders WHERE OID NOT IN ('" + not_in_delete_oids + "') AND Exchanges_Id = 2", callback);
	}

	var fetch = function( params ){

		/* url, data, method, error, callback */

		if ( !params.url ){
			logger( new Error('No URL given'), true );
		}

		if ( params.data ){
			params.data.name = key;
			params.data.pass = secret;
		}else{
			params.data = {
				name    : key,
				pass    : secret
			};
		}

		var https   = require('https');
		var qs      = require('querystring');

		var take_response = function(res){

			var whole_response = '';

			res.on('data', function(chunk){
				whole_response += chunk;
			});

			res.on('end', function(){
				return params.callback( whole_response );
			});
		};

		if ( params.method && params.method == 'GET' ){

			get_http_options.path = params.url;

			get_http_options.path += "?" + qs.stringify( params.data );

			var request = https.get( get_http_options , take_response ).on('error', params.error );
			request.end();

		}else{

			post_http_options.path = params.url;

			var post_data_string    = qs.stringify( params.data );

			post_http_options.headers['Content-Length'] = post_data_string.length;

			//console.log(post_data_string);

			var request = https.request( post_http_options , take_response ).on('error', params.error );

			request.write(post_data_string);
			request.end();
		}
	}

	var setBalance = function( symbol, val ){

		if ( !val ){
			return;
		}

		this[symbol] = val;
		db.query("UPDATE Exchanges SET `" + symbol + "` = " + val + ", Dt = NOW() WHERE Id = 2");
	}

	return {
				USD : -1,
				BTC : -1,
                EUR : -1,
				getOrders : function ( error, callback ) {

					console.log("Getting open orders at TradeHill");

					var self = this;

					var retry = 3;

					var error_handler = function(err){

												if ( retry == 0 ){
													throw err;
													return;
												}

												logger(err, false);
												console.log("Retrying - " + retry + " retry left");
												retry--;

												fetch(params);
											};

					var params = {
						url         : '/APIv1/USD/GetOrders',
						error       : error_handler,
						callback    : function( data ){
							try {
							   var json = JSON.parse(data);
							} catch ( err ) {
								error_handler( err );
								return;
							}

							console.log(json);

							if ( json.error ){
								error_handler( new Error( json.error ) );
								return;
							}

							update_orders( json.orders, callback );
						}
					};

		            fetch(params);
				},
				getBalance : function ( error, callback ) {

					console.log("Getting balance at TradeHill");

					var self = this;

					var retry = 3;

					var error_handler = function(err){

												if ( retry == 0 ){
													throw err;
													return;
												}

												logger(err, false);
												console.log("Retrying - " + retry + " retry left");
												retry--;

												fetch(params);
											};

					var params = {
						url         : '/APIv1/USD/GetBalance',
						error       : error_handler,
						callback    : function(data){

	                        try {
	                            var json = JSON.parse(data);
	                        } catch ( err ) {
		                        error_handler( err );
								return;
	                        }

							if ( json.error ){
								error_handler( new Error( json.error ) );
								return;
							}

							setBalance('USD', json.USD );
							setBalance('BTC', json.BTC );
							setBalance('EUR', json.EUR );

							callback();
	                    }
					};

                    fetch(params);
				},
				getRates : function ( error, callback ) {

					console.log("Getting rates at TradeHill");

					var curr = ['USD','EUR'];

					var inserted = 0;

					for(var i = 0; i < curr.length; i++) {
					 (function(i) {

						 var retry = 3;

						 var error_handler = function(err){

														if ( retry == 0 ){
															throw err;
															return;
														}

														logger(err, false);
														console.log("Retrying - " + retry + " retry left " + params.url );
														retry--;

														fetch(params);
													};

							var params = {
								url         : '/APIv1/' + curr[i] + '/Ticker',
								error       : error_handler,
								callback    : function(data){

									try {
										var json = JSON.parse(data);
									} catch ( err ) {
										error_handler( err );
										return;
									}

									console.log("Got " + curr[i] + " rates at TradeHill");

									if ( json.error ){
										error_handler( new Error( json.error ) );
										return;
									}

									db.query(
									       "UPDATE Rates SET Bid = ?, Ask = ?, Dt = NOW() " +
									       "WHERE Exchanges_Id = 2 AND Currencies_Id IN " +
									           "(SELECT Id FROM Currencies WHERE Symbol = '" + curr[i] + "')",
									       [ json.ticker.buy, json.ticker.sell]
									);

									if ( ++inserted == curr.length ){
										callback();
									}
								}
							};

							fetch(params);
					 })(i);
					}
				},
				buy : function ( input_params ) {

					console.log("Buying " + input_params.amount + " at MtGOX");

					if ( input_params.amount <= 0 ){

						var err = new Error('Amount is incorrect : ' + input_params.amount );

						if ( input_params.error ){
							input_params.error( err );
							return;
						}else{
							throw err;
						}
					}

					if ( !input_params.currency ){
						input_params.currency = 'USD';
					}


					var self = this;

					var retry = 3;

					var error_handler = function(err){

												if ( retry == 0 ){
													throw err;
													return;
												}

												logger(err, false);
												console.log("Retrying - " + retry + " retry left");
												retry--;

												fetch(params);
											};

					var params = {
						url         : '/api/0/buyBTC.php',
						data        : {
										amount      : input_params.amount,
										Currency    : input_params.currency
									},
						error       : error_handler,
						callback    : function( data ){
							try {
							   var json = JSON.parse(data);
							} catch ( err ) {
								error_handler( err );
								return;
							}

							if ( json.error ){
								error_handler( new Error( json.error ) );
								return;
							}

							update_orders( json.orders, input_params.callback );
						}
					};

					if ( input_params.price ) params.data.price = input_params.price;

					fetch(params);
				},
				sell : function ( input_params ) {

					console.log("Selling " + input_params.amount + " at MtGOX");

					if ( input_params.amount <= 0 ){

						var err = new Error('Amount is incorrect : ' + input_params.amount );

						if ( input_params.error ){
							input_params.error( err );
							return;
						}else{
							throw err;
						}
					}

					if ( !input_params.currency ){
						input_params.currency = 'USD';
					}


					var self = this;

					var retry = 3;

					var error_handler = function(err){

												if ( retry == 0 ){
													throw err;
													return;
												}

												logger(err, false);
												console.log("Retrying - " + retry + " retry left");
												retry--;

												fetch(params);
											};

					var params = {
						url         : '/api/0/sellBTC.php',
						data        : {
										amount      : input_params.amount,
										Currency    : input_params.currency
									},
						error       : error_handler,
						callback    : function( data ){
							try {
							   var json = JSON.parse(data);
							} catch ( err ) {
								error_handler( err );
								return;
							}

							console.log(json);

							if ( json.error ){
								error_handler( new Error( json.error ) );
								return;
							}

							update_orders( json.orders, input_params.callback );
						}
					};

					if ( input_params.price ) params.data.price = input_params.price;

					fetch(params);
				},
				cancel : function ( input_params ) {

					if ( !input_params.oid ){

						var err = new Error('No order id supplied');

						if ( input_params.error ){
							input_params.error( err );
							return;
						}else{
							throw err;
						}
					}

					var self = this;

					var retry = 3;

					var error_handler = function(err){

												if ( retry == 0 ){
													throw err;
													return;
												}

												logger(err, false);
												console.log("Retrying - " + retry + " retry left");
												retry--;

												fetch(params);
											};

					var params = {
						url         : '/api/0/cancelOrder.php',
						data        : {
										oid     : input_params.oid
									},
						error       : error_handler,
						callback    : function( data ){
							try {
							   var json = JSON.parse(data);
							} catch ( err ) {
								error_handler( err );
								return;
							}

							if ( json.error ){
								error_handler( new Error( json.error ) );
								return;
							}

							setBalance('USD', json.usds );
							setBalance('BTC', json.btcs );

							update_orders( json.orders, input_params.callback );
						}
					};

					fetch(params);
				}
	}
};