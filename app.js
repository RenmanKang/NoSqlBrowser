var express = require('express');
var i18n = require('i18n');
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var browserify = require('browserify');
var proxy = require('express-http-proxy');
var conf = require('./config/config');
var i18n_config = require('./lib/i18n_config');
var logger = require('./lib/logger').accessLogger;

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// uncomment after placing your favicon in /public
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(i18n.init);
app.use(i18n_config.init);

var sess_opt = {
	name : 'server.sid',
	secret : 'nosql browser',
	resave : false,
	saveUninitialized : false,
	cookie : {
		path : '/',
		httpOnly : true,
		maxAge : conf.session.maxAge || 86400000
	}
};
if(conf.redis) {
	var RedisStore = require('connect-redis')(session);
	var redisClient = require('redis').createClient(conf.redis.port, conf.redis.host);
	sess_opt.store = new RedisStore({ client: redisClient });
}
app.use(session(sess_opt));

app.use(function(req, res, next) {
	logger.info([
		req.headers['x-forwarded-for'] || req.client.remoteAddress,
		req.method,
		req.url,
		res.statusCode,
		req.headers.referer || '-',
		req.headers['user-agent'] || '-'
	].join('\t'));
	next();
});
app.use(express.static(path.join(__dirname, 'public'), conf.session || {maxAge:86400000}));

// Init routes
require('./dispatch').dispatch(app);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

module.exports = app;
