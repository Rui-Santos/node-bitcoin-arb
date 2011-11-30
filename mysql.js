var config = require('./config');

var mysql = require('mysql').createClient({
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password
});

mysql.query('USE ' + config.mysql.database );

module.exports = mysql;