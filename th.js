var db = require("./mysql");

var MTGOX = module.exports = function ( key, secret ) {

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
                console.log("Transport layer at TradeHill");
                error(e);
			});

			request.end();

		}else{

			post_http_options.path = url;

            var post_data;

            if ( data ){
                post_data = data;
                post_data['name'] = key;
                post_data['pass'] = secret;
            }else{
                post_data = { name: key, pass: secret };
            }

			var post_data_string    = qs.stringify( post_data );

            post_http_options.headers['Content-Length'] = post_data_string.length;

			var request = https.request( post_http_options , take_response ).on('error', function(e) {
				console.log("Transport layer at TradeHill");
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

                    fetch('/APIv1/USD/GetBalance','','POST', function(error){ throw error }, function(data){

                        try {
                            var json = JSON.parse(data);
                        } catch ( err ) {
                            throw err;
                        }

                        self.USD = json.USD;
                        self.BTC = json.BTC;

                        if ( json.EUR ){
                            self.EUR = json.EUR;
                        }else{
                            self.EUR = -1;
                        }

                        db.query(
                            "UPDATE `Exchanges` SET " +
                            "   `USD` = ?, BTC = ?, EUR = ?, Dt = NOW()" +
                            "WHERE" +
                            "   Code = 'th'"
                            , [ self.USD, self.BTC, self.EUR ], callback );
                    });
				},
                getRates : function ( callback ) {

                    var curr = ['USD','EUR'];

                    var inserted = 0;

                    for(var i = 0; i < curr.length; i++) {
                        (function(i) {
                            fetch('/APIv1/' + curr[i] + '/Ticker','','GET', function(error){ throw error }, function(data){
                                try {
                                    var json = JSON.parse(data);
                                } catch ( err ) {
                                    throw err;
                                }

                                console.log( curr[i] + " - " + json.ticker.buy + " - " + json.ticker.sell );

                                db.query(
                                        "UPDATE Rates SET Bid = ?, Ask = ?, Dt = NOW() " +
                                        "WHERE Exchanges_Id = 2 AND Currencies_Id = " +
                                            "( SELECT Id FROM Currencies WHERE Symbol = '" + curr[i] + "' )",
                                        [ json.ticker.buy, json.ticker.sell ]
                                );

                                if ( ++inserted == curr.length ){
                                  db.end();
                                  callback();
                                }
                            });
                        })(i);
                    }
                }
	}
};