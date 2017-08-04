'use strict';

var async = require('async');
var inflection = require('inflection');
var myutil = require('../../lib/redis_util');
var logger = require('../../lib/logger').appLogger;
var redisConnections = require('./index').redisConnections;
var foldingCharacter = ":";

exports.getServersInfo = function(req, res, next) {
	logger.debug('getServersInfo::START');
	if(redisConnections.length > 0) {
		var allServerInfo = [];
		redisConnections.forEach(function (redisConnection, index) {
			getServerInfo(redisConnection, function (err, serverInfo) {
				if(err) {
					logger.error('getServersInfo:: getServerInfo error; ', err);
					return next(err);
				}
				allServerInfo.push(serverInfo);
				if(index === redisConnections.length - 1) {
					var timeout = setInterval(function () {
						if(allServerInfo.length === redisConnections.length) {
							clearInterval(timeout);
							logger.debug('getServersInfo::END:allServerInfo');
							return res.send(JSON.stringify(allServerInfo));
						}
					}, 100);
				}
			});
		});
	} else {
		logger.warn('getServersInfo::EMD: No redisConnections');
		return next("No redis connection");
	}
}

exports.getKeyDetails = function(req, res, next) {
	var connectionId = decodeURIComponent(req.params.connectionId);
	var key = decodeURIComponent(req.params.key);
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		logger.debug('loading key "%s" from "%s"', key, connectionId);
		redisConnection.type(key, function (err, type) {
			if (err) {
				logger.error('getKeyDetails', err);
				return next(err);
			}

			switch (type) {
				case 'string':
					return getKeyDetailsString(key, redisConnection, res, next);
				case 'list':
					return getKeyDetailsList(key, redisConnection, req, res, next);
				case 'zset':
					return getKeyDetailsZSet(key, redisConnection, req, res, next);
				case 'hash':
					return getKeyDetailsHash(key, redisConnection, res, next);
				case 'set':
					return getKeyDetailsSet(key, redisConnection, res, next);
			}

			var details = {
				key: key,
				type: type
			};
			res.send(JSON.stringify(details));
		});
	});
}

exports.postKey = function(req, res, next) {
	var connectionId = decodeURIComponent(req.params.connectionId);
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		if (req.query.action === 'delete') {
			deleteKey(redisConnection, req, next, res);
		} else {
			saveKey(redisConnection, req, next, res);
		}
	});
}

exports.postKeys = function(req, res, next) {
	var key = req.params.key;
	var connectionId = req.params.connectionId;
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		if (req.query.action === 'delete') {
			deleteKeys(key, redisConnection, res, next);
		} else {
			next(new Error("Invalid action '" + req.query.action + "'"));
		}
	});
}

exports.postAddListValue = function(req, res, next) {
	var key = req.body.key;
	var value = req.body.stringValue;
	var type = req.body.type;
	var connectionId = req.body.listConnectionId;
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		addListValue(redisConnection, key, value, type, res, next);
	});
}

exports.postEditListRow = function(req, res, next) {
	var key = req.body.listKey;
	var index = req.body.listIndex;
	var value = req.body.listValue;
	var connectionId = req.body.listConnectionId;
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		editListRow(redisConnection, key, index, value, res, next);
	});
}

exports.postEditZSetRow = function(req, res, next) {
	var key = req.body.zSetKey;
	var score = req.body.zSetScore;
	var value = req.body.zSetValue;
	var oldValue = req.body.zSetOldValue;
	var connectionId = req.body.zSetConnectionId;
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		editZSetRow(redisConnection, key, score, value, oldValue, res, next);
	});
}

exports.postEditHashRow = function(req, res, next) {
	var key = req.body.hashKey;
	var field = req.body.hashField;
	var value = req.body.hashFieldValue;
	var connectionId = req.body.hashConnectionId;
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		editHashRow(redisConnection, key, field, value, res, next);
	});
}

exports.getKeysTree = function(req, res, next) {
	var connectionId = decodeURIComponent(req.params.connectionId);
	var prefix = req.params.keyPrefix;
	logger.debug('getKeysTree:connectionId; ', connectionId);
	logger.debug('loading keys by prefix ', prefix);
	var search;
	if (prefix) {
		search = prefix + foldingCharacter + '*';
	} else {
		search = '*';
	}
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		redisConnection.keys(search, function (err, keys) {
			if (err) {
				logger.error('getKeys', err);
				return next(err);
			}
			logger.debug('found %s keys for "%s"', keys.length, prefix);

			var lookup = {};
			var reducedKeys = [];
			keys.forEach(function (key) {
				var fullKey = key;
				if (prefix) {
					key = key.substr((prefix + foldingCharacter).length);
				}
				var parts = key.split(foldingCharacter);
				var firstPrefix = parts[0];
				if (lookup.hasOwnProperty(firstPrefix)) {
					lookup[firstPrefix].count++;
				} else {
					lookup[firstPrefix] = {
						attr: { id: firstPrefix },
						count: parts.length === 1 ? 0 : 1
					};
					lookup[firstPrefix].fullKey = fullKey;
					if (parts.length === 1) {
						lookup[firstPrefix].leaf = true;
					}
					reducedKeys.push(lookup[firstPrefix]);
				}
			});

			reducedKeys.forEach(function (data) {
				if (data.count === 0) {
					data.data = data.attr.id;
				} else {
					data.data = data.attr.id + ":* (" + data.count + ")";
					data.state = "closed";
				}
			});

			async.forEachLimit(reducedKeys, 10, function (keyData, callback) {
				if (keyData.leaf) {
					redisConnection.type(keyData.fullKey, function (err, type) {
						if (err) {
							return callback(err);
						}
						keyData.attr.rel = type;
						var sizeCallback = function (err, count) {
							if (err) {
								return callback(err);
							} else {
								keyData.data += " (" + count + ")";
								callback();
							}
						};
						if (type == 'list') {
							redisConnection.llen(keyData.fullKey, sizeCallback);
						} else if (type == 'set') {
							redisConnection.scard(keyData.fullKey, sizeCallback);
						} else if (type == 'zset') {
							redisConnection.zcard(keyData.fullKey, sizeCallback);
						} else {
							callback();
						}
					});
				} else {
					callback();
				}
			}, function (err) {
				if (err) {
					logger.error('getKeys', err);
					return next(err);
				}
				reducedKeys = reducedKeys.sort(function (a, b) {
					return a.data > b.data ? 1 : -1;
				});
				res.send(JSON.stringify(reducedKeys));
			});
		});
	});
}

exports.getKeys = function(req, res, next) {
	var connectionId = decodeURIComponent(req.params.connectionId);
	getConnection(redisConnections, connectionId, function (err, redisConnection) {
		var prefix = req.params.keyPrefix;
		var limit = req.params.limit || 100;
		logger.debug('loading keys by prefix "%s"', prefix);
		redisConnection.keys(prefix, function (err, keys) {
			if (err) {
				logger.error('getKeys', err);
				return next(err);
			}
			logger.debug('found %s keys for "%s"', keys.length, prefix);

			if (keys.length > 1) {
				keys = myutil.distinct(keys.map(function (key) {
					var idx = key.indexOf(foldingCharacter, prefix.length);
					if (idx > 0) {
						return key.substring(0, idx + 1);
					}
					return key;
				}));
			}

			if (keys.length > limit) {
				keys = keys.slice(0, limit);
			}

			keys = keys.sort();
			res.send(JSON.stringify(keys));
		});
	});
}

exports.postExec = function(req, res) {
	var cmd = req.body.cmd;
	var connectionId = req.body.connection;
	var redisConnection;
	getConnection(redisConnections, connectionId, function (err, connection) {
		redisConnection = connection;
	});
	var parts = myutil.split(cmd);
	if (!redisConnection[parts[0]]) {
		return res.send("ERROR: Invalid command");
	}

	var commandName = parts[0];
	var args = parts.slice(1);
	args.push(function (err, results) {
		if (err) {
			return res.send(err.message);
		}
		return res.send(JSON.stringify(results));
	});
	redisConnection[commandName].apply(redisConnection, args);
}

exports.isConnected = function(req, res) {
	if (redisConnections[0]) {
		return res.send(true);
	}
	return res.send(false);
}

function getConnection (redisConnections, connectionId, callback) {
	var connectionIds = connectionId.split(":");
	var desiredHost = connectionIds[0];
	var desiredPort = connectionIds[1];
	var desiredDb = connectionIds[2];
	redisConnections.forEach(function (connection) {
		if (connection.connection_options.host == desiredHost && connection.connection_options.port == desiredPort && connection.selected_db == desiredDb) {
			return callback(null, connection);
		}
	});
}

function getServerInfo (redisConnection, callback) {
	redisConnection.info(function (err, serverInfo) {
		if(err) {
			logger.error('getServerInfo error;', err);
			return callback(err);
		}
		var infoLines = serverInfo
			.split('\n')
			.map(function (line) {
				line = line.trim();
				var parts = line.split(':');
				return {
					key: inflection.humanize(parts[0]),
					value: parts.slice(1).join(':')
				};
			});
		var connectionInfo = {
			host: redisConnection.connection_options.host,
			port: redisConnection.connection_options.port,
			db: redisConnection.selected_db,
			info: infoLines
		};
		return callback(null, connectionInfo);
	});

}

function getKeyDetailsString (key, redisConnection, res, next) {
	redisConnection.get(key, function (err, val) {
		if (err) {
			logger.error('getKeyDetailsString', err);
			return next(err);
		}

		var details = {
			key: key,
			type: 'string',
			value: val
		};
		myutil.encodeHTMLEntities(JSON.stringify(details), function (string) {
			res.send(string);
		})
	});
}

function getKeyDetailsList (key, redisConnection, req, res, next) {
	var startIdx = parseInt(req.params.index, 10);
	if (typeof(startIdx) == 'undefined' || isNaN(startIdx) || startIdx < 0) {
		startIdx = 0;
	}
	var endIdx = startIdx + 19;
	redisConnection.lrange(key, startIdx, endIdx, function (err, items) {
		if (err) {
			logger.error('getKeyDetailsList', err);
			return next(err);
		}

		var i = startIdx;
		items = items.map(function (item) {
			return {
				number: i++,
				value: item
			}
		});
		redisConnection.llen(key, function (err, length) {
			if (err) {
				logger.error('getKeyDetailsList', err);
				return next(err);
			}
			var details = {
				key: key,
				type: 'list',
				items: items,
				beginning: startIdx <= 0,
				end: endIdx >= length - 1,
				length: length
			};
			myutil.encodeHTMLEntities(JSON.stringify(details), function (string) {
				res.send(string);
			})
		});
	});
}

function getKeyDetailsHash (key, redisConnection, res, next) {
	redisConnection.hgetall(key, function (err, fieldsAndValues) {
		if (err) {
			logger.error('getKeyDetailsHash', err);
			return next(err);
		}

		var details = {
			key: key,
			type: 'hash',
			data: fieldsAndValues
		};
		myutil.encodeHTMLEntities(JSON.stringify(details), function (string) {
			res.send(string);
		})
	});
}

function getKeyDetailsSet (key, redisConnection, res, next) {
	redisConnection.smembers(key, function (err, members) {
		if (err) {
			logger.error('getKeyDetailsSet', err);
			return next(err);
		}

		var details = {
			key: key,
			type: 'set',
			members: members
		};
		myutil.encodeHTMLEntities(JSON.stringify(details), function (string) {
			res.send(string);
		})
	});
}

function getKeyDetailsZSet (key, redisConnection, req, res, next) {
	var startIdx = parseInt(req.params.index, 10);
	if (typeof(startIdx) == 'undefined' || isNaN(startIdx) || startIdx < 0) {
		startIdx = 0;
	}
	var endIdx = startIdx + 19;
	redisConnection.zrange(key, startIdx, endIdx, 'WITHSCORES', function (err, items) {
		if (err) {
			logger.error('getKeyDetailsZSet', err);
			return next(err);
		}

		items = mapZSetItems(items);

		var i = startIdx;
		items.forEach(function (item) {
			item.number = i++;
		});
		redisConnection.zcount(key, "-inf", "+inf", function (err, length) {
			var details = {
				key: key,
				type: 'zset',
				items: items,
				beginning: startIdx <= 0,
				end: endIdx >= length - 1,
				length: length
			};
			myutil.encodeHTMLEntities(JSON.stringify(details), function (string) {
				res.send(string);
			})
		});
	});
}

function addSetValue (redisConnection, key, value, res, next) {
	return redisConnection.sadd(key, value, function (err) {
		if (err) {
			logger.error('addSetValue', err);
			return next(err);
		}
		res.send('ok');
	});
}
function addSortedSetValue (redisConnection, key, score, value, res, next) {
	return redisConnection.zadd(key, score, value, function (err) {
		if (err) {
			logger.error('addZSetValue', err);
			return next(err);
		}
		res.send('ok');
	});
}

function addListValue (redisConnection, key, value, type, res, next) {
	var callback = function (err) {
		if (err) {
			logger.error('addListValue', err);
			return next(err);
		}
		return res.send('ok');
	};
	myutil.decodeHTMLEntities(value, function (decodedString) {
		value = decodedString;
	});
	switch (type) {
		case 'lpush':
			return redisConnection.lpush(key, value, callback);
		case 'rpush':
			return redisConnection.rpush(key, value, callback);
		default:
			var err = new Error("invalid type");
			logger.error('addListValue', err);
			return next(err);
	}
}

function editListRow (redisConnection, key, index, value, res, next) {
	myutil.decodeHTMLEntities(value, function (decodedString) {
		value = decodedString;
		redisConnection.lset(key, index, value, function (err) {
			if (err) {
				logger.error('editListRow', err);
				return next(err);
			}
			if (value === "REDISCOMMANDERTOMBSTONE") {
				redisConnection.lrem(key, 0, value, function (err) {
					if (err) {
						logger.error('removeListRow', err);
						return next(err);
					}
					res.send('ok');
				});
			} else {
				res.send('ok');
			}
		});
	});
}

function editZSetRow (redisConnection, key, score, value, oldValue, res, next) {
	myutil.decodeHTMLEntities(oldValue, function (decodedString) {
		oldValue = decodedString;

		redisConnection.zrem(key, oldValue, function (err) {
			if (err) {
				logger.error('editZSetRow', err);
				return next(err);
			}
			if (value === "REDISCOMMANDERTOMBSTONE") {
				return res.send('ok');
			} else {
				myutil.decodeHTMLEntities(value, function (decodedString) {
					value = decodedString;
					redisConnection.zadd(key, score, value, function (err) {
						if (err) {
							logger.error('editZSetRow', err);
							return next(err);
						}
						return res.send('ok');
					});
				});
			}
		});
	});
}

function editHashRow (redisConnection, key, field, value, res, next) {
	myutil.decodeHTMLEntities(field, function (decodedField) {
		myutil.decodeHTMLEntities(value, function (decodedValue) {
			if (value === "REDISCOMMANDERTOMBSTONE") {
				redisConnection.hdel(key, decodedField, function (err) {
					if (err) {
						logger.error('editHashRow', err);
						return next(err);
					}
					return res.send('ok');
				});
			} else {
				redisConnection.hset(key, decodedField, decodedValue, function (err) {
					if (err) {
						logger.error('editHashRow', err);
						return next(err);
					}
					return res.send('ok');
				})
			}
		});
	});
}

function saveKey (redisConnection, req, next, res) {
	var key = req.params.key;
	logger.debug('saving key "%s"', key);
	redisConnection.type(key, function (err, type) {
		if (err) {
			logger.error('saveKey', err);
			return next(err);
		}
		var value = req.body.stringValue;
		myutil.decodeHTMLEntities(value, function (decodedString) {
			value = decodedString;
		});
		var score = parseInt(req.body.keyScore, 10);
		var formType = req.body.keyType;
		type = typeof(formType) == 'undefined' ? type : formType;
		switch (type) {
			case 'string':
			case 'none':
				return posKeyDetailsString(redisConnection, key, req, res, next);
			case 'list':
				return addListValue(redisConnection, key, value, 'lpush', res, next);
			case 'set':
				return addSetValue(redisConnection, key, value, res, next);
			case 'zset':
				return addSortedSetValue(redisConnection, key, score, value, res, next);
			default:
				return next(new Error("Unhandled type " + type));
		}
	});
}

function deleteKey (redisConnection, req, next, res) {
	var key = req.params.key;
	logger.debug('deleting key "%s"', key);
	redisConnection.del(key, function (err) {
		if (err) {
			logger.error('deleteKey', err);
			return next(err);
		}

		return res.send('ok');
	});
}

function posKeyDetailsString (redisConnection, key, req, res, next) {
	var val = req.body.stringValue;
	myutil.decodeHTMLEntities(val, function (decodedString) {
		val = decodedString;
		logger.debug("after:", val);
	});
	redisConnection.set(key, val, function (err) {
		if (err) {
			logger.error('posKeyDetailsString', err);
			return next(err);
		}
		res.send('OK');
	});
}

function deleteKeys (keyQuery, redisConnection, res, next) {
	redisConnection.keys(keyQuery, function (err, keys) {
		if (err) {
			logger.error('deleteKeys', err);
			return next(err);
		}

		async.forEachLimit(keys, 10, function (key, callback) {
			redisConnection.del(key, callback);
		}, function (err) {
			if (err) {
				logger.error('deleteKeys', err);
				return next(err);
			}
			return res.send('ok');
		})
	});
}

function mapZSetItems (items) {
	var results = [];
	for (var i = 0; i < items.length; i += 2) {
		results.push({
			score: items[i + 1],
			value: items[i]
		});
	}
	return results;
}
