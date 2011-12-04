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
						headers : {
									'User-Agent'    : 'btb',
									'Rest-Key'      : key,
									'Rest-Sign'     : 'MUST BE UPDATED',
									'Accept'        : 'application/json',
									'Content-Type'  : 'application/x-www-form-urlencoded'
								}
                        };

	var error_wrapper = function( msg ){
		console.log( Date.now() + " Error - MTGOX : " + msg );
	}

	var fetch = function( url, data, method, error, callback ){

		if ( !url ){
			error_wrapper("No URL specified");
			error('No URL specified');
			return;
		}

		var https   = require('https');
		var qs      = require('querystring');

		var take_response = function(res){

				var whole_response = '';

				res.on('data', function(chunk){
					whole_response += chunk;
				});

				res.on('end', function(){
					callback( whole_response );
				});

		};

		if ( method == 'GET' ){

			get_http_options.path = url;

			if ( data ){
				get_http_options.path += "?" + qs.stringify(data);
			}

			var request = https.get( get_http_options , take_response ).on('error', function(e) {
				error(e);
			});

			request.end();

		}else{

			var crypto  = require('crypto');

			post_http_options.path = url;

			var post_data           = data || {};
			post_data['nonce']      = Date.now();
			var post_data_string    = qs.stringify( post_data );

			var secret_binary   = Buffer( secret, 'base64').toString('binary');
			var hash            = crypto.createHmac('sha512', secret_binary );

			post_http_options.headers['Rest-Sign'] = hash.update(post_data_string).digest('base64');

			var request = https.request( post_http_options , take_response ).on('error', function(e) {
				console.log("Transport layer at MTGOX");
				error(e);
			});

			request.write(post_data_string);
			request.end();
		}
	}

	return {
				USD : -1,
				BTC : -1,
                EUR : -1,
				getBalance : function ( callback ) {
                    var self = this;

                    fetch('/api/0/info.php','','', function(error){ throw error }, function(data){
                        try {
                            var json = JSON.parse(data);
                        } catch ( err ) {
                            throw err;
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

                        db.end();
                    });
				},
                getRates : function ( callback ) {

                    var self = this;

                    var curr = ['USD','EUR'];

                    var inserted = 0;

                    for(var i = 0; i < curr.length; i++) {
                        (function(i) {
                            fetch('/api/1/BTC' + curr[i] + '/public/ticker','','GET', function(error){ throw error }, function(data){

                                try {
                                    var json = JSON.parse(data);
                                } catch ( err ) {
                                    throw err;
                                }

                                if ( json.result != 'success' ){
                                    throw "MtGOX " + curr[i] + " ticker response error";
                                    return;
                                }

                                db.query(
                                        "UPDATE Rates SET Bid = ?, Ask = ? " +
                                        "WHERE Exchanges_Id = 1 AND Currencies_Id IN " +
                                            "(SELECT Id FROM Currencies WHERE Symbol = '" + curr[i] + "')",
                                        [ json.return.buy.value, json.return.sell.value]
                                );

                                db.end();

                                if ( ++inserted == curr.length ){
                                  callback();
                                }
                            });
                        })(i);
                    }
                }
	}
};