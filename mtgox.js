var db = require("./mysql");

var MTGOX = module.exports = function ( key, secret ) {

	var get_http_options = {
                        host    : 'mtgox.com',
                        method  : 'GET',
						headers : {
									'User-Agent'    : 'btb'
								}
                        };

	var post_http_options = {
                        host    : 'mtgox.com',
                        method  : 'POST',
						/*port    : 321,*/
						headers : {
									'User-Agent'    : 'btb',
									'Rest-Key'      : key,
									'Rest-Sign'     : 'MUST BE UPDATED',
									'Accept'        : 'application/json',
									'Content-Type'  : 'application/x-www-form-urlencoded'
								}
                        };

	var logger = function( err, throw_exception ){

		var time = new Date();

		console.error( time.toUTCString() + " - MTGOX - " + err.message );

		if ( throw_exception ){
			throw err;
		}
	}

	var fetch = function( params ){

		/* url, data, method, error, callback */

		if ( !params.url ){
			logger( new Error('No URL given'), true );
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

			if ( params.data ){
				get_http_options.path += "?" + qs.stringify( params.data );
			}

			var request = https.get( get_http_options , take_response ).on('error', params.error );
			request.end();

		}else{

			var crypto  = require('crypto');

			post_http_options.path = params.url;

			var post_data           = params.data || {};
			post_data['nonce']      = Date.now();
			var post_data_string    = qs.stringify( post_data );

			var secret_binary   = Buffer( secret, 'base64').toString('binary');
			var hash            = crypto.createHmac('sha512', secret_binary );

			post_http_options.headers['Rest-Sign'] = hash.update(post_data_string).digest('base64');

			var request = https.request( post_http_options , take_response ).on('error', params.error );

			request.write(post_data_string);
			request.end();
		}
	}

	var setBalance = function( symbol, val ){
		this[symbol] = val;
		db.query("UPDATE Exchanges SET `" + symbol + "` = " + val + " WHERE Id = 1");
	}

	return {
				USD : -1,
				BTC : -1,
                EUR : -1,
				getBalance : function ( error, callback ) {

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
						url         : '/api/0/info.php',
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

	                        self.USD = json.Wallets.USD.Balance.value;
	                        self.BTC = json.Wallets.BTC.Balance.value;

	                        if ( json.Wallets.EUR ){
	                            self.EUR = json.Wallets.EUR.Balance.value;
	                        }else{
	                            self.EUR = -1;
	                        }

	                        db.query(
	                            "UPDATE `Exchanges` SET " +
	                            "   `USD` = ?, BTC = ?, EUR = ?, Dt = NOW()" +
	                            "WHERE" +
	                            "   Code = 'mtgox'"
	                            , [ self.USD, self.BTC, self.EUR ], callback );
	                    }
					};

                    fetch(params);
				},
				getRates : function ( error, callback ) {

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
								url         : '/api/1/BTC' + curr[i] + '/public/ticker',
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

									db.query(
									       "UPDATE Rates SET Bid = ?, Ask = ?, Dt = NOW() " +
									       "WHERE Exchanges_Id = 1 AND Currencies_Id IN " +
									           "(SELECT Id FROM Currencies WHERE Symbol = '" + curr[i] + "')",
									       [ json.return.buy.value, json.return.sell.value]
									);

									if ( ++inserted == curr.length ){
										db.end();
										callback();
									}
								}
							};

							fetch(params);
					 })(i);
					}
				}
	}
};