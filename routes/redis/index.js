'use strict';

var fs = require('fs');
var async = require('async');
var path = require('path');
var redis = require('redis');
var conf = require('../../config/config');
var redis_util = require('../../lib/redis_util');
var logger = require('../../lib/logger').appLogger;

var redisConnections = [];
redisConnections.getLast = redis_util.getLast;

exports.redisConnections = redisConnections;

function startDefaultConnections(connections, callback) {
	logger.debug('startDefaultConnections::START');
	connections.forEach(function(connection) {
		logger.debug('startDefaultConnections::Redis host:'+connection.host+', port:'+connection.port+', db:'+connection.dbIndex);
		var redisCli = redis.createClient(connection.port, connection.host);
		redisCli.selected_db = connection.dbIndex;
		if(connection.password) {
			redisCli.auth(connection.password, function (err) {
				if(err) {
					logger.error('startDefaultConnections::auth error; ', err);
					callback(err);
					return;
				}
			});
		}
		redisCli.on("error", function (err) {
			logger.error("Redis error", err);
		});
		redisCli.on("end", function () {
			logger.info("Connection closed. Attempting to Reconnect...");
		});
		redisCli.once("connect", connectToDB.bind(this, redisCli, redisCli.selected_db));
		redisConnections.push(redisCli);
		//setUpConnection(redisConnections.getLast(), connection.dbIndex);
	});
	logger.debug('startDefaultConnections::END');
	callback(null);
}

function setUpConnection(redisConnection, db) {
	logger.debug('setUpConnection::START:Redis host:'+redisConnection.connection_options.host+', port:'+redisConnection.connection_options.port);
	redisConnection.selected_db = db;

	redisConnection.on("error", function (err) {
		logger.error("Redis error", err);
	});
	redisConnection.on("end", function () {
		logger.info("Connection closed. Attempting to Reconnect...");
	});
	redisConnection.once("connect", connectToDB.bind(this, redisConnection, db));
	logger.debug('setUpConnection::END:Redis host:'+redisConnection.connection_options.host+', port:'+redisConnection.connection_options.port+', db:'+redisConnection.selected_db);
}

function connectToDB(redisConnection, db) {
	logger.debug('connectToDB::START:Redis host:'+redisConnection.connection_options.host+', port:'+redisConnection.connection_options.port);
	redisConnection.select(db, function (err) {
		if(err) {
			logger.error('Redis connection select error; ', err);
			process.exit();
		}
		logger.info("connectToDB::Redis Connection " + redisConnection.connection_options.host + ":" + redisConnection.connection_options.port + " Using Redis DB #" + redisConnection.selected_db);
	});
	logger.debug('connectToDB::END:Redis host:'+redisConnection.connection_options.host+', port:'+redisConnection.connection_options.port);
}

exports.index = function(req, res) {
	if(redisConnections.length) {
		logger.debug('redisConnections count;', redisConnections.length);
		renderIndex(res);
		return;
	}

	async.waterfall([
		function(cb) {
			redis_util.getConfig(function(err, config) {
				if(err || !config || !config.default_connections) {
					logger.info("getHome::No config found; ", err);
					logger.info("getHome::Using default configuration.");
					config = {
						"sidebarWidth": 250,
						"locked": false,
						"CLIHeight": 50,
						"CLIOpen": false,
						"default_connections": [{ host: conf.redis.host, port: conf.redis.port, dbIndex: 0 }]
					};
					logger.info('getHome::Save default configuration; ', config);
					redis_util.saveConfig(config, function(err) {
						if(err) {
							logger.error("getHome::Default configuration save error; ", err);
						}
					});
				}
				logger.debug('default_connections;', config.default_connections);
				cb(null, config);
			});
		},
		function(config, cb) {
			startDefaultConnections(config.default_connections, function(err) {
				if(err) {
					logger.error('Default connection start error;', err);
				}
				cb(null);
			});
		}
	], function(err) {
		renderIndex(res);
	});
};

function renderIndex(res) {
	res.locals.getConnections = function () {
		return redisConnections;
	}
	var title = res.__i('title');
	var host = conf.redis.host;
	var port = conf.redis.port;
	res.render('redis/index.ejs', {
		title: title,
		host: host,
		port: port
	});
}

exports.postLogin = function(req, res, next) {
	async.waterfall([
		function(cb) {
			redis_util.getConfig(function (err, config) {
				if(err) {
					logger.error("postLogin:: No config found. Using default configuration.", err);
					config = {
						"sidebarWidth": 250,
						"locked": false,
						"CLIHeight": 50,
						"CLIOpen": false,
						"default_connections": []
					};
				}
				if(!config['default_connections']) {
					config['default_connections'] = [];
				}

				var newConnection = {};
				newConnection['host'] = req.body.hostname;
				newConnection['port'] = req.body.port;
				req.body.password && (newConnection['password'] = req.body.password);
				newConnection['dbIndex'] = req.body.dbIndex;

				if(!containsConnection(config.default_connections, newConnection)) {
					login(newConnection, function(err) {
						if(err) {
							logger.error('postLogin:: Cannot register new server; Invalid server info; ', err);
							cb({status: 401, message: res.__i('Cannot register new server; Invalid server info.') });
						} else {
							config['default_connections'].push(newConnection);
							cb(null, config);
						}
					});
				} else {
					logger.warn('postLogin:: The server that already exists; ', newConnection);
					cb({ status: 403, message: res.__i('The server that already exists.') });
				}
			});
		},
		function(config, cb) {
			logger.debug('postLogin:: Saving new connection config; ', config);
			redis_util.saveConfig(config, function (err) {
				if(err) {
					logger.error('postLogin:: New connection config save error; ', err);
					cb({ status: 500, message: res.__i('New server not saved.') });
				} else {
					cb(null);
				}
			});
		}
	], function(err) {
		if(err) {
			var res_err = {};
			if(typeof err === 'object') {
				if(err.status) {
					res_err.status = err.status;
				} else {
					res_err.status = 500;
				}
				if(err.message) {
					res_err.message = err.message;
				} else {
					res_err.message = err;
				}
			} else {
				res_err = { status: 500, message: err };
			}
			res.json(res_err);
		} else {
			res.json({ status: 200, message: 'ok'});
		}
	});
}

exports.postLogout = function(req, res, next) {
	var connectionId = req.params.connectionId;
	var connectionIds = connectionId.split(":");
	var host = connectionIds[0];
	var port = connectionIds[1];
	var db = connectionIds[2];
	async.waterfall([
		function(cb) {
			logout(host, port, db, cb);
		},
		function(cb) {
			redis_util.getConfig(cb);
		},
		function(config, cb) {
			if(config.default_connections) {
				removeConnectionFromDefaults(config.default_connections, connectionIds, function (err, newDefaults) {
					if(err) {
						logger.error('Config remove error; ', err);
						cb(null);
					} else {
						config.default_connections = newDefaults;
						logger.debug('postLogout:: Saving new config; ', config);
						redis_util.saveConfig(config, cb);
					}
				});
			} else {
				logger.info('postLogout:: No Connections');
				cb(null);
			}
		}
	], function(err) {
		if(err) {
			logger.error('postLogout::Process error; ', err);
			return next(err);
		} else {
			if (!res._headerSent) {
				return res.send('OK');
			} else {
				return next(null);
			}
		}
	});
}

exports.getConfig = function(req, res) {
	redis_util.getConfig(function (err, config) {
		if(err) {
			logger.error("No config found. Using default configuration.", err);
			config = {
				"sidebarWidth": 250,
				"locked": false,
				"CLIHeight": 50,
				"CLIOpen": false,
				"default_connections": []
			};
		}
		return res.json(config);
	});
}

exports.postConfig = function(req, res) {
	var config = req.body;
	if (!config) {
		logger.warn('postConfig::No config sent');
		res.json({ status: 401, message: 'No config sent.' });
	} else {
		redis_util.saveConfig(config, function (err) {
			if(err) {
				logger.error('Config save error;', err);
				res.json({ status: 500, message: 'Config save error' });
			} else {
			res.json({ status: 200, message: 'OK' });
			}
		});
	}
}

function removeConnectionFromDefaults (connections, connectionIds, callback) {
	var notRemoved = true;
	var hostname = connectionIds[0];
	var port = connectionIds[1];
	var db = connectionIds[2];
	connections.forEach(function (connection, index) {
		/**
		 * Here is a bug here.
		 *
		 * When I disconnect an instance, there is always an error message in console like this:
		 * "Could not remove localhost:6379:1 from default connections."
		 *
		 * So I run into the code and locate the bug here. As I output connection in console:
		 * "console.log(connection);"
		 * its output is just like this:
		 * "{ host: 'localhost', port: '6379', password: '', dbIndex: '2' }"
		 *
		 * There is no such a 'selected_db' property in connection.
		 * I modified the code below to fix this bug.
		 */
		if (notRemoved && connection.host == hostname && connection.port == port && connection.dbIndex == db) {
			notRemoved = false;
			connections.splice(index, 1);
		}
	});
	if (notRemoved) {
		return callback("Could not remove " + hostname + ":" + port + ":" + db + " from default connections.");
	} else {
		return callback(null, connections);
	}
}

function containsConnection (connectionList, object) {
	var contains = false;
	connectionList.forEach(function (element) {
		if (element.host == object.host && element.port == object.port && element.dbIndex == object.dbIndex) {
			contains = true;
		}
	});
	return contains;
}

function login(newConnection, callback) {
	var host = newConnection.host;
	var port = newConnection.port;
	var password = newConnection.password;
	var dbIndex = newConnection.dbIndex;
	logger.debug('connecting... ', host, port);
	redisConnections.push(redis.createClient(port, host));
	redisConnections.getLast().on("error", function (err) {
		logger.error("Redis error", err);
	});
	redisConnections.getLast().on("end", function () {
		logger.info("Connection closed. Attempting to Reconnect...");
	});
	if(password) {
		return redisConnections.getLast().auth(password, function (err) {
			if(err) {
				logger.error("Could not authenticate", err);
				if(callback) {
					callback(err);
					callback = null;
				}
				return;
			}
			redisConnections.getLast().on("connect", selectDatabase);
		});
	} else {
		return redisConnections.getLast().on("connect", selectDatabase);
	}

	function selectDatabase () {
		try {
			dbIndex = parseInt(dbIndex || 0);
		} catch (e) {
			return callback(e);
		}

		return redisConnections.getLast().select(dbIndex, function (err) {
			if(err) {
				logger.error("Could not select database", err);
				if(callback) {
					callback(err);
					callback = null;
				}
				return;
			}
			logger.info("Using Redis DB #" + dbIndex);
			return callback();
		});
	}
}

function logout (hostname, port, db, callback) {
	var notRemoved = true;
	redisConnections.forEach(function (instance, index) {
		if (notRemoved && instance.connection_options.host == hostname && instance.connection_options.port == port && instance.selected_db == db) {
			notRemoved = false;
			var connectionToClose = redisConnections.splice(index, 1);
			connectionToClose[0].quit();
		}
	});
	if (notRemoved) {
		return callback(new Error("Could not remove ", hostname, port, "."));
	} else {
		return callback(null);
	}
}
