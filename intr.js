var db = require("./mysql");

var INTERSANGO = module.exports = function ( key, accounts ) {

	var getAccounts = function(){
		return accounts;
	};

	var get_http_options = {
						host    : "intersango.com",
                        method  : "GET",
						headers : {
									'User-Agent'    : 'btb'
								}
                        };

	var post_http_options = {
						host    : "intersango.com",
                        method  : "POST",
						headers : {
									'User-Agent'    : 'btb',
									'Accept'        : 'application/json',
									'Content-Type'  : 'application/x-www-form-urlencoded'
								}
                        };

	var logger = function( err, throw_exception ){

		var time = new Date();

		console.error( time.toUTCString() + " - Intersango - " + err.message );

		if ( throw_exception ){
			throw err;
		}
	}

    var update_rates = function( symbol, bid, ask ){
        db.query(
               "UPDATE Rates SET Bid = ?, Ask = ?, Dt = NOW() " +
               "WHERE Exchanges_Id = 4 AND Currencies_Id IN " +
                   "(SELECT Id FROM Currencies WHERE Symbol = ?)",
               [ bid, ask, symbol]
        );
    };

	var update_orders = function( symbol, orders ){

		var order_ids = [];

		var orders_sql = '';

		orders.forEach(function(order){

			if ( order.fulfilled || order.cancelled ) return;

			var buysell = order.selling == true ? 'sell' : 'buy';

			orders_sql = "INSERT DELAYED INTO " +
					"Orders( Exchanges_Id, Currencies_Id, OID, Status, BuySell, Dt, Amount, Price, Partial_Amount ) " +
					"SELECT 4, Id, ? , ? , ? , ?, ?, ?, ? " +
					"FROM Currencies WHERE Symbol = ? " +
					"ON DUPLICATE KEY UPDATE " +
					" Status = VALUES(Status), Partial_Amount = VALUES( Partial_Amount )";

			db.query( orders_sql, [ order.id, 1, buysell, order.placed.substr(0, 19),
									order.quantity, order.rate, order.base_amount_traded, symbol ] );

			order_ids.push(order.id);
		});

		var not_in_delete_oids = order_ids.join("','");

		db.query("UPDATE Orders SET Status = 'filled' WHERE Status IN ('opened','queued') " +
				" AND `OID` NOT IN ('" + not_in_delete_oids +"') AND Exchanges_Id = 4 AND " +
				" Currencies_Id = ( SELECT Id FROM Currencies WHERE Symbol = '" + symbol + "' ) ");
	}

	var fetch = function( params ){

		/* url, data, method, error, callback */

		if ( !params.url ){
			logger( new Error('No URL given'), true );
		}

		if ( params.data ){
			params.data.api_key = key;
		}else{
			params.data = {
				api_key    : key
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
		db.query("UPDATE Exchanges SET `" + symbol + "` = " + val + ", Dt = NOW() WHERE Id = 4");
	}

	var getAccId = function(symbol){

		var acc_id = '';

		accounts.forEach(function(acc){
			if ( acc.symbol == symbol ){
				acc_id = acc.id;
			}
		});

		return acc_id;
	}

	return {
				"USD": -1,
				"BTC": -1,
                "GBP": -1,
                "PLN": -1,
                "EUR": -1,
				getOrders : function ( error, callback ) {

					var curr = getAccounts();

					var inserted = 0;

					for( var i = 0; i < curr.length; i++ ) {
					 (function( acc ){

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
								url         : '/api/authenticated/v0.1/listOrders.php',
								data        : {
												"account_id" : acc.id,
												"filters" : {
													"states" : ["open","queued"]
												}
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

									if ( json.length == 0 ){
										console.log("No open orders at Intersango for " + acc.symbol );
										return;
									}

									update_orders( acc.symbol, json );

									console.log("Got open orders at Intersango for " + acc.symbol );

									if ( ++inserted == curr.length ){
										if ( callback ){
											return callback();
										}
									}
								}
							};

						    console.log("Getting open orders at Intersango for " + acc.symbol );

				            fetch(params);
					 })(curr[i]);
					}
				},
				getBalance : function ( error, callback ) {

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
                        url         : '/api/authenticated/v0.1/listAccounts.php',
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

                                json.forEach(function(acc){
                                    setBalance( acc.currency_abbreviation , acc.balance );
                                });

                                console.log("Got balance at Intersango");

                                if ( callback ){
                                    return callback();
                                }
                            }
                    };

                    console.log("Getting balance at Intersango");

                    fetch(params);
				},
				getRates : function ( error, callback ) {

					console.log("Getting rates at Intersango");

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
                        url         : '/api/ticker.php',
                        method      : 'GET',
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

                            update_rates( "GBP" , json['1'].buy, json['1'].sell );
                            update_rates( "EUR" , json['2'].buy, json['2'].sell );
                            update_rates( "USD" , json['3'].buy, json['3'].sell );
                            update_rates( "PLN" , json['4'].buy, json['4'].sell );

                            console.log("Got rates at Intersango");

                            if ( callback ){
                                return callback();
                            }
                        }
                    };

                    fetch(params);
				},
				buy : function ( input_params ) {

					console.log("Buying " + input_params.amount + " at Intersango");

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

					if ( !input_params.price ){
						input_params.price = 9999999999;
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
						url         : '/api/authenticated/v0.1/placeLimitOrder.php',
						data        : {
										quantity            : input_params.amount,
										rate                : input_params.price,
										selling             : false,
										base_account_id     : 932919096247,
										quote_account_id    : getAccId( input_params.currency ),
										type                : "gtc"
									},
						error       : error_handler,
						callback    : function( data ){
							try {
							   var json = JSON.parse(data);
							} catch ( err ) {
								error_handler( err );
								return;
							}

							if ( json.error && json.error.substr(0,28) != "You do not have enough funds" ){
								error_handler( new Error( json.error ) );
								return;
							}else if( json.error && json.error.substr(0,28) == "You do not have enough funds" ){
								console.log("Not enough funds to buy " + input_params.amount + " at Intersango");
								if ( input_params.error ){
									return input_params.error();
								}else{
									return false;
								}
							}

							order_sql = "INSERT DELAYED INTO " +
									"Orders( Exchanges_Id, Currencies_Id, OID, Status, BuySell, Dt, Amount, Price ) " +
									"SELECT 4, Id, ? , ? , ? , NOW(), ?, ? " +
									"FROM Currencies WHERE Symbol = ?";

							db.query(
										order_sql,
										[ json.order_id, "queued", "buy", input_params.amount, input_params.price, input_params.currency],
										input_params.callback
							);

							console.log("Bought " + input_params.amount + " at Intersango");
						}
					};

					fetch(params);
				},
				sell : function ( input_params ) {

						console.log("Selling " + input_params.amount + " at Intersango");

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

						if ( !input_params.price ){
							input_params.price = 9999999999;
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
							url         : '/api/authenticated/v0.1/placeLimitOrder.php',
							data        : {
											quantity            : input_params.amount,
											rate                : input_params.price,
											selling             : true,
											base_account_id     : 932919096247,
											quote_account_id    : getAccId( input_params.currency ),
											type                : "gtc"
										},
							error       : error_handler,
							callback    : function( data ){
								try {
								   var json = JSON.parse(data);
								} catch ( err ) {
									error_handler( err );
									return;
								}

								if ( json.error && json.error.substr(0,28) != "You do not have enough funds" ){
									error_handler( new Error( json.error ) );
									return;
								}else if( json.error && json.error.substr(0,28) == "You do not have enough funds" ){
									console.log("Not enough funds to sell " + input_params.amount + " at Intersango");
									if ( input_params.error ){
										return input_params.error();
									}else{
										return false;
									}
								}

								order_sql = "INSERT DELAYED INTO " +
										"Orders( Exchanges_Id, Currencies_Id, OID, Status, BuySell, Dt, Amount, Price ) " +
										"SELECT 4, Id, ? , ? , ? , NOW(), ?, ? " +
										"FROM Currencies WHERE Symbol = ? ";


								db.query(
											order_sql,
											[ json.order_id, "queued", "sell", input_params.amount, input_params.price, input_params.currency],
											input_params.callback
								);

								console.log("Sold " + input_params.amount + " at Intersango");
							}
						};

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

					var params = {};

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

					db.query("SELECT Symbol FROM Currencies WHERE Id = (" +
							"SELECT Currencies_Id FROM Orders WHERE OID = ? AND Exchanges_Id = 4)",
							[input_params.oid],
							function( err, results, fields ){

								if ( results.length == 0 ){
									throw new Error( "No such order exists" );
									return;
								}

								params = {
									url         : '/api/authenticated/v0.1/requestCancelOrder.php',
									data        : {
													account_id  : getAccId( results[0].Symbol ),
													order_id    : input_params.oid
												},
									error       : error_handler,
									callback    : function( data ){
										try {
										   var json = JSON.parse(data);
										} catch ( err ) {
											error_handler( err );
											return;
										}

										if ( json.result != "success" ){
											error_handler( new Error( json.error ) );
											return;
										}

										db.query(
												"UPDATE Orders SET Status = 'cancelled' WHERE OID = ? AND Exchanges_Id = 4",
												[input_params.oid],
												input_params.callback
										);

										console.log("Cancelled order  " + input_params.oid + " at TradeHill");
									}
								};

								fetch(params);
							}
					);
				}
	}
};