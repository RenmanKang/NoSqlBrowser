var _ = require('underscore');
var async = require('async');
var moment = require('moment');
var http = require('http');
var mongodb = require('mongodb');
var os = require('os');
var conf = require('../config/config');
var bson = require('../lib/bson');
var utils = require('../lib/utils');
var logger = require('../lib/logger').appLogger;

var dbServer;
var mongoClient = mongodb.MongoClient;
var moduleName = utils.getFileName(module.filename);

function getDbServerInfo() {
	if(dbServer) return dbServer;

	dbServer = {
		host: conf.mongodb.host || 'localhost',
		port: conf.mongodb.port || 27017,
		options : {
			auto_reconnect: conf.mongodb.auto_reconnect,
			poolSize: conf.mongodb.min_connection
		}
	};
	conf.mongodb.user && (dbServer.user = conf.mongodb.user);
	conf.mongodb.password && (dbServer.password = conf.mongodb.password);
	logger.debug('['+moduleName+'][getDbInfo] MongoDB info;', dbServer);
	return dbServer;
}

function getMongoDBUrl(db) {
	var server = getDbServerInfo();
	var url = 'mongodb://';
	if(server.user && server.password) {
		url += server.user+':'+server.password+'@';
	}
	url += server.host+':'+server.port+'/';
	db && (url += db);
	return url;

}

exports.index = function(req, res) {
	logger.debug('['+moduleName+'][index] Response mongodb tool page');
	var title = res.__i('title');
	var dbServer = getDbServerInfo();
	res.render('mongodb/index', {
		layout: false,
		title: title,
		mongodb: dbServer.host+':'+dbServer.port
	});
};

exports.getDbTrees = function(req, res) {
	var dbName = req.query.path;
	if(dbName === '#') dbName = null;
	if(dbName) {
		logger.debug('['+moduleName+'][getDbTrees] Get collection list for %s', dbName);
		getCollections(req, res);
	} else {
		logger.debug('['+moduleName+'][getDbTrees] Get database list');
		getDatabases(req, res);
	}
};

exports.viewServerStatus = function(req, res) {
	logger.debug('['+moduleName+'][viewServerStatus] View server status');
	var dbServer = getDbServerInfo();
	var _mongoDB = new mongodb.Db('local', new mongodb.Server(dbServer.host, dbServer.port, dbServer.options));
	var _db;
	async.waterfall([
		function(cb) {
			_mongoDB.open(cb);
		},
		function(db, cb) {
			_db = db;
			//db.admin(cb);
			cb(null, db.admin());
		},
		function(admDb, cb) {
			if(dbServer.user && dbServer.password) {
				admDb.authenticate(dbServer.user, dbServer.password, function (err, result) {
					if (err) {
						logger.error('['+moduleName+'][viewServerStatus] MongoDB authenticate error; ', err);
					}
					cb(err, admDb);
				});
			} else {
				cb(null, admDb);
			}
		},
		function(admDb, cb) {
			admDb.serverStatus(cb);
		}
	], function(err, info) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][viewServerStatus] MongoDB Database connect error; ', err);
			res.render('mongodb/error', {
				layout: false,
				message: 'Error',
				error: err
			});
		} else {
			logger.debug('['+moduleName+'][viewServerStatus] Server status; ', info.host);
			res.render('mongodb/status', {
				layout: false,
				moment: moment,
				info: info
			});
		}
	});
};

exports.getDatabaseStats = function(req, res) {
	logger.debug('Response mongodb database stats');
	var dbName = req.params.database;
	logger.debug('['+moduleName+'][getDatabaseStats] dbName:'+dbName);
	var mongodb_url = getMongoDBUrl(dbName);
	var tabId = 'stats__' + new Buffer(dbName).toString('base64').replace(/[=]/g, '_');
	var ctx = {
		tabId: tabId
	};
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			db.stats(cb);
		}
	], function(err, stats) {
		_db && _db.close();
		if (err) {
			logger.error('[' + moduleName + '][getDatabaseStats] database stat error; ', err);
			//res.json({ status: 500, message: utils.getErrMsg(err) });
			ctx.stats = utils.getErrMsg(err);
		} else {
			logger.error('[' + moduleName + '][getDatabaseStats] database stat result; ', stats);
			//res.json({ status: 200, message: stats });
			ctx.stats = bson.toString(stats);
		}
		res.render('mongodb/stats', ctx);
	});
};

function getDatabases(req, res) {
	logger.debug('['+moduleName+'][getDatabases] Get database list');
	var dbServer = getDbServerInfo();
	var _mongoDB = new mongodb.Db('local', new mongodb.Server(dbServer.host, dbServer.port, dbServer.options));
	var list = [];
	if(req.query._new) {
		list.push({
			id: 'NewDatabase',
			text: 'New Database',
			icon: 'glyphicon glyphicon-plus',
			a_attr: { role: '_new' },
			children: false
		});
	}
	var _db;
	async.waterfall([
		function(cb) {
			_mongoDB.open(cb);
		},
		function(db, cb) {
			_db = db;
			//db.admin(cb);
			cb(null, db.admin());
		},
		function(admDb, cb) {
			if(dbServer.user && dbServer.password) {
				admDb.authenticate(dbServer.user, dbServer.password, function(err, result) {
					if(err) {
						logger.error('['+moduleName+'][getDatabases] MongoDB authenticate error; ', err);
					}
					cb(err, admDb);
				});
			} else {
				cb(null, admDb);
			}
		},
		function(admDb, cb) {
			admDb.listDatabases(cb);
		}
	], function(err, dbs) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][getDatabases] MongoDB listDatabases select error; ', err);
		} else {
			dbs.databases.forEach(function(db) {
				var dbName = db.name;
				list.push({
					id: dbName,
					text: dbName,
					//icon: 'glyphicon glyphicon-th-large',
					icon: '/img/icon/database.png',
					a_attr: { role: dbName },
					children: true
				});
			});
			list = _.sortBy(list, 'text');
		}
		res.json(list);
	});
}

exports.viewDatabase = function(req, res) {
	logger.debug('Response mongodb database page');
	var dbName = req.params.database;
	logger.debug('['+moduleName+'][viewDatabase] dbName:'+dbName);
	var mongodb_url = getMongoDBUrl(dbName);
	var list = [];
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			db.collections(cb);
		}
	], function(err, collections) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][viewDatabase] MongoDB collections select error; ', err);
			res.render('mongodb/error', {
				layout: false,
				message: 'Error',
				error: err
			});
		} else {
			var colls = [];
			for(var r in collections) {
				var coll = collections[r].s.name;
				colls.push(coll);
			}
			colls = colls.sort();
			logger.debug('['+moduleName+'][viewDatabase] collection count; ', collections.length);
			res.render('mongodb/database', {
				layout: false,
				dbName: dbName,
				colls: colls
			});
		}
	});
};

exports.addDatabase = function(req, res) {
	var dbName = req.params.database;

	if(dbName === undefined || dbName.length === 0) {
		logger.error('['+moduleName+'][addDatabase] That database name is invalid.');
		res.json({ status: 403, message: 'That database name is invalid' });
		return;
	}

	//Database names must begin with a letter or underscore, and can contain only letters, underscores, numbers or dots
	if(!dbName.match(/^[a-zA-Z_][a-zA-Z0-9\._-]*$/)) {
		logger.error('['+moduleName+'][addDatabase] That database name is invalid. [%s]', dbName);
		res.json({ status: 403, message: 'That database name('+dbName+') is invalid.' });
		return;
	}

	var dbServer = getDbServerInfo();
	var _mongoDB = new mongodb.Db(dbName, new mongodb.Server(dbServer.host, dbServer.port, dbServer.options));
	var _db;
	async.waterfall([
		function(cb) {
			_mongoDB.open(cb);
		},
		function(db, cb) {
			_db = db;
			db.createCollection('delete_me', cb);
		}
	], function(err) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][addDatabase] Database create error; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][addDatabase] Database added; ', dbName);
			res.json({ status: 200, message: dbName });
		}
	});
};

exports.renameDatabase = function(req, res) {
	res.json({ status: 403, message: 'Currently not implemented' });
};

exports.deleteDatabase = function(req, res) {
	var dbName = req.params.database;
	logger.error('['+moduleName+'][deleteDatabase] database name: %s', dbName);

	if(dbName === undefined || dbName.length === 0) {
		logger.error('['+moduleName+'][deleteDatabase] That database name is invalid.');
		res.json({ status: 403, message: 'That database name is invalid' });
		return;
	}

	//Database names must begin with a letter or underscore, and can contain only letters, underscores, numbers or dots
	if(!dbName.match(/^[a-zA-Z_][a-zA-Z0-9\._-]*$/)) {
		logger.error('['+moduleName+'][deleteDatabase] That database name is invalid. [%s]', dbName);
		res.json({ status: 403, message: 'That database name('+dbName+') is invalid.' });
		return;
	}

	var dbServer = getDbServerInfo();
	var _mongoDB = new mongodb.Db(dbName, new mongodb.Server(dbServer.host, dbServer.port, dbServer.options));
	async.waterfall([
		function(cb) {
			_mongoDB.open(cb);
		},
		function(db, cb) {
			db.dropDatabase(cb);
		}
	], function(err) {
		if(err) {
			logger.error('['+moduleName+'][deleteDatabase] Database delete error; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][deleteDatabase] Database deleted; ', dbName);
			res.json({ status: 200, message: dbName });
		}
	});
};

exports.getCollectionStats = function(req, res) {
	logger.debug('Response mongodb collection stats');
	var dbName = req.params.database;
	var colName = req.params.collection;
	logger.debug('['+moduleName+'][getCollectionStats] dbName:'+dbName);
	var mongodb_url = getMongoDBUrl(dbName);

	var tabId = 'stats__' + new Buffer(dbName+'/'+colName).toString('base64').replace(/[=]/g, '_');
	var ctx = {
		tabId: tabId
	};
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.stats(cb);
		}
	], function(err, stats) {
		_db && _db.close();
		if (err) {
			logger.error('[' + moduleName + '][getCollectionStats] collection stat error; ', err);
			//res.json({ status: 500, message: utils.getErrMsg(err) });
			ctx.stats = utils.getErrMsg(err);

		} else {
			logger.error('[' + moduleName + '][getCollectionStats] collection stat result; ', stats);
			//res.json({ status: 200, message: stats });
			ctx.stats = bson.toString(stats);
		}
		res.render('mongodb/stats', ctx);
	});
};


function getCollections(req, res) {
	var dbName = req.query.path;
	if(dbName === '#') dbName = null;
	logger.debug('['+moduleName+'][getCollections] dbName:'+dbName);
	var mongodb_url = getMongoDBUrl(dbName);
	var list = [];
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			db.collections(cb);
		}
	], function(err, collections) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][getCollections] MongoDB collections select error; ', err);
		} else {
			var coll, icon;
			collections.forEach(function(collection) {
				coll = collection.s.name;
				if(coll === 'system.users') {
					icon = '/img/icon/users.png'
				} else if(coll === 'system.js') {
					icon = '/img/icon/function.png'
				} else {
					//icon = 'glyphicon glyphicon-list-alt';
					icon = '/img/icon/table2.png';
				}
				list.push({
					id: new Buffer(dbName+'/'+coll).toString('base64').replace(/[=]/g, '_'),
					text: coll,
					icon: icon,
					a_attr: { role: dbName+'/'+coll },
					children: false
				});
			});
			list = _.sortBy(list, 'text');
		}
		res.json(list);
	});
}

exports.addCollection = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	logger.debug('['+moduleName+'][addCollection] dbName:'+dbName+', colName:'+colName);
	var mongodb_url = getMongoDBUrl(dbName);

	if(colName === undefined || colName.length === 0) {
		logger.warn('['+moduleName+'][addCollection] You forgot to enter a collection name!');
		res.json({ status: 403, message: 'You forgot to enter a collection name!' });
		return;
	}

	//Collection names must begin with a letter or underscore, and can contain only letters, underscores, numbers or dots
	if(!colName.match(/^[a-zA-Z_][a-zA-Z0-9\._-]*$/)) {
		logger.warn('['+moduleName+'][addCollection] That collection name is invalid.');
		res.json({ status: 403, message: 'That collection name is invalid.' });
		return;
	}

	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			db.createCollection(colName, cb);
		}
	], function(err, collection) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][addCollection] Something went wrong; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][addCollection] Collection created; ', collection);
			res.json({ status: 200, message: 'OK' });
		}
	});
};

exports.viewCollection = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	logger.debug('['+moduleName+'][viewCollection] dbName:'+dbName+', colName:'+colName);
	var mongodb_url = getMongoDBUrl(dbName);

	var limit = 10;
	var skip = parseInt(req.query.skip, 10) || 0;
	var query_options = {
		limit: limit,
		skip: skip
	};

	// some query filter
	var query = {};
	var key = req.query.key || '';
	var value = req.query.value || '';
	var type = req.query.type || '';

	if(key && value) {
		var t = type.toUpperCase();
		// If type == J, convert value as json document
		if(t == 'J') {
			value = JSON.parse(req.query.value);
		}
		// If type == N, convert value to Number
		else if(t == 'N') {
			value = Number(req.query.value);
		}
		// If type == O, convert value to ObjectID
		// TODO: Add ObjectID validation to prevent error messages.
		else if(t == 'O') {
			value = bson.toObjectId(req.query.value);
			if(!value) {
				logger.warn('['+moduleName+'][viewCollection] ObjectIDs must be 24 characters long!;', req.query.value);
			}
		}
		query[key] = value;
	}

	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.find(query, query_options).toArray(function(err, items) {
				col.stats(function(err, stats) {

					//Pagination
					//Have to do this here, swig template doesn't allow any calculations :(
					var prev, prev2, back2, here, next2, next, last;

					prev = {
						page: Math.round((skip - limit) / limit) + 1,
						skip: skip - limit
					};
					prev2 = {
						page: Math.round((skip - limit * 2) / limit) + 1,
						skip: skip - limit * 2
					};
					next2 = {
						page: Math.round((skip + limit * 2) / limit) + 1,
						skip: skip + limit * 2
					};
					next = {
						page: Math.round((skip + limit) / limit) + 1,
						skip: skip + limit
					};
					here = Math.round(skip / limit) + 1;
					last = (Math.ceil(stats.count / limit) - 1) * limit;

					var docs = [];

					for(var i in items) {
						docs[i] = items[i];
						items[i] = bson.toString(items[i]);
					}

					var ctx = {
						layout: false,
						dbName: dbName,
						colName: colName,
						documents: items, //Docs converted to strings
						docs: docs, //Original docs
						stats: stats,
						convertBytes: require('../lib/utils').convertBytes,
						limit: limit,
						skip: skip,
						prev: prev,
						prev2: prev2,
						next2: next2,
						next: next,
						here: here,
						last: last,
						key: key,
						value: value,
						type: type
					};

					cb(null, ctx);
				});
			});
		}
	], function(err, ctx) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][viewCollection] MongoDB collection view error; ', err);
			res.render('mongodb/error', {
				layout: false,
				message: 'Error',
				error: err
			});
		} else {
			res.render('mongodb/collection', ctx);
		}
	});
};

exports.renameCollection = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	var newName = req.body.collection;
	logger.debug('['+moduleName+'][renameCollection] dbName:'+dbName+', colName:'+colName+', newCol:'+newName);
	var mongodb_url = getMongoDBUrl(dbName);

	if(newName == undefined || newName.length == 0) {
		logger.warn('['+moduleName+'][renameCollection] You forgot to enter a collection name!');
		res.json({ status: 403, message: 'You forgot to enter a collection name!' });
		return;
	}

	//Collection names must begin with a letter or underscore, and can contain only letters, underscores, numbers or dots
	if(!newName.match(/^[a-zA-Z_][a-zA-Z0-9\._-]*$/)) {
		logger.warn('['+moduleName+'][renameCollection] That collection name is invalid.', newName);
		res.json({ status: 403, message: 'That collection name is invalid. collection: '+newName });
		return;
	}

	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.rename(newName, cb);
		}
	], function(err, collection) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][renameCollection]  Something went wrong; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][renameCollection]  Collection renamed; ', collection);
			res.json({ status: 200, message: 'OK' });
		}
	});
};

exports.deleteCollection = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	logger.debug('['+moduleName+'][deleteCollection] dbName:'+dbName+', colName:'+colName);
	var mongodb_url = getMongoDBUrl(dbName);

	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.drop(cb);
		}
	], function(err, result) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][deleteCollection]  Collection delete error; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][deleteCollection]  Collection deleted; ');
			res.json({ status: 200, message: 'OK' });
		}
	});
};

/**
 * GET /api/mongodb/:database/:collection
 *
 * @param req
 * @param res
 */
exports.listDocument = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	logger.debug('['+moduleName+'][listDocument] dbName:'+dbName+', colName:'+colName);
	var mongodb_url = getMongoDBUrl(dbName);

	var tabId = 'col__' + new Buffer(dbName+'/'+colName).toString('base64').replace(/[=]/g, '_');

	var limit = parseInt(req.query.limit, 10) || 50;
	var skip = parseInt(req.query.skip, 10) || 0;
	var options = {
		limit: limit,
		skip: skip
	};

	var ctx = {
		dbname: dbName,
		collection: colName,
		tabId: tabId,
		limit: limit,
		skip: skip
	};

	// some conds filter
	var conds = {};
	var _db, _col;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			_col = db.collection(colName);
			_col.find(conds, options).toArray(function(err, items) {
				if(err) {
					cb(err);
				} else {
					var docs = [], documents = [];
					for(var i in items) {
						docs[i] = items[i];
						documents[i] = bson.toString(items[i]);
					}

					ctx.documents = documents.join(',\n'); //Docs converted to strings
					ctx.docs = docs; //Original docs
					cb();
				}
			});
		},
		function(cb) {
			_col.stats(function(err, stats) {
				if(err) {
					cb(err);
				} else {
					ctx.stats = stats;
					ctx.convertBytes = require('../lib/utils').convertBytes;
					cb();
				}
			});
		}
	], function(err) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][listDocument] MongoDB collection documents find error; ', err);
			ctx.documents = err.toString();
//			res.json({ status: 500, message: err.toString() });
		} else {
//			res.json({ status: 200, message: ctx });
		}
		res.render('mongodb/browse', ctx);
	});
};

function parseObject(obj) {
	if(obj === null || obj === undefined) {
		return obj;
	} else if(Array.isArray(obj)) {
		var arr = [];
		obj.forEach(function(item) {
			arr.push(parseObject(item));
		});
		return arr;
	} else if(typeof obj === 'object') {
		var res = {};
		var keys = Object.keys(obj);
		keys.forEach(function(key) {
			res[key] = parseObject(obj[key]);
		});
		return res;
	} else if(typeof obj === 'string') {
		return str2obj(obj);
	} else {
		console.log('other:'+obj);
		return obj;
	}
}

function str2obj(val) {
	var m1 = /ObjectId\s*\(\s*"([-:.0-9A-Za-z]+)"\s*\)/i;
	var m2 = /ISODate\s*\(\s*"([-:.0-9A-Za-z]+)"\s*\)/i;
	var m3 = /Code\s*\(\s*"([\n\r\s()*+,-.0-9:;A-Z\[\]a-z{}]+)"\s*\)/i;
	var obj1 = val.match(m1);
	var obj2 = val.match(m2);
	var obj3 = val.match(m3);
	if(obj1) { // ObjectId
		val = new mongodb.ObjectID(val.replace(m1, obj1[1]));
	} else if(obj2) { // ISODate
		val = new Date(val.replace(m2, obj2[1]));
	} else if(obj3) { // Code
		val = new mongodb.Code(val.replace(m3, obj3[1]));
	}
	return val;
}

/**
 * POST /api/mongodb/:database/:collection
 *
 * @param req
 * @param res
 */
exports.searchDocument = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	logger.debug('['+moduleName+'][searchDocument] dbName:'+dbName+', colName:'+colName);
	var mongodb_url = getMongoDBUrl(dbName);

	var VALID_CMD = ['find', 'insert', 'update', 'remove', 'count', 'findOne', 'aggregate' ];
	// find, findOne, count, distinct, findAndModify, insert, update, remove, aggregate, mapReduce
	var cmd = (req.query.cmd || '');
	if(VALID_CMD.indexOf(cmd) === -1) {
		logger.error('['+moduleName+'][searchDocument] MongoDB Invalid command; ', cmd);
		res.json({ status: 400, message: 'Invalid command' });
	}

	var conds = parseObject(req.body.condition || {});
	logger.debug('['+moduleName+'][searchDocument] conds;', conds);

	var document = req.body.document;
	document && (document = parseObject(document));
	logger.debug('['+moduleName+'][searchDocument] document;', document);

	var options = req.body.options || {};
	logger.debug('['+moduleName+'][searchDocument] options;', options);

	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			if(cmd === 'find') {
				var limit = parseInt(req.query.limit, 10) || 50;
				var skip = parseInt(req.query.skip, 10) || 0;
				options.limit = limit;
				options.skip = skip;
				col.find(conds, options).toArray(cb);
			} else if(cmd === 'insert') {
				if(document) {
					col.insert(document, options, cb);
				} else {
					cb('Invalid document');
				}
			} else if(cmd === 'update') {
				col.update(conds, document, options, cb);
			} else if(cmd === 'remove') {
				col.remove(conds, options, cb);
			} else if(cmd === 'count') {
				col.count(conds, options, cb);
			} else if(cmd === 'findOne') {
				col.findOne(conds, options, cb);
			} else if(cmd === 'aggregate') {
				col.aggregate(conds, options, cb);
			} else {
				cb('Invalid request');
			}
		}
	], function(err, docs) {
		_db && _db.close();
		var results = {	status: 200, message: '' };
		if(err) {
			logger.error('['+moduleName+'][searchDocument] MongoDB command error; ', err);
			results.status = 500;
			results.message = err.toString();
			res.json({ status: 500, message: err.toString() });
		} else if(docs) {
			logger.debug('['+moduleName+'][searchDocument]  command result ok');
			if(Array.isArray(docs)) {
				var orgDocs = [];
				for(var i in docs) {
					orgDocs[i] = docs[i];
					docs[i] = bson.toString(docs[i]);
				}
				var strDocs = docs.join(',\n');
				results.message = strDocs;
			} else {
				results.message = bson.toString(docs);
			}
		} else {
			results.message = 'Not found';
		}
		res.json(results);
	});
};

exports.addDocument = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	var doc = req.body.document;

	logger.debug('['+moduleName+'][addDocument] dbName:'+dbName+', colName:'+colName);

	if(doc == undefined || doc.length == 0) {
		logger.warn('['+moduleName+'][addDocument] You forgot to enter a document!');
		res.json({ status: 403, message: 'You forgot to enter a document!' });
		return;
	}

	var docBSON;
	try {
		docBSON = bson.toBSON(doc);
	} catch (err) {
		logger.warn('['+moduleName+'][addDocument] That document is not valid!');
		res.json({ status: 403, message: 'That document is not valid!' });
		return;
	}

	var mongodb_url = getMongoDBUrl(dbName);
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.insert(docBSON, cb);
		}
	], function(err, result) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][addDocument] Something went wrong; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][addDocument] result ok; ');
			res.json({ status: 200, message: 'OK' });
		}
	});
};

exports.viewDocument = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	var docId = req.params.document;
	logger.debug('['+moduleName+'][viewDocument] dbName:'+dbName+', colName:'+colName+', docId:'+docId);

	if(docId.length == 24) {
		//Convert id string to mongodb object ID
		try {
			docId = new mongodb.ObjectID.createFromHexString(docId);
		} catch (err) {
			logger.error('['+moduleName+'][viewDocument] Document ID convert error; ', err);
		}
	}

	var mongodb_url = getMongoDBUrl(dbName);
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.findOne({_id : docId }, cb);
		}
	], function(err, doc) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][viewDocument] MongoDB document view error; ', err);
			res.render('mongodb/error', {
				layout: false,
				message: 'Error',
				error: err
			});
		} else {
			logger.debug('['+moduleName+'][viewDocument] result ok; ');
			res.render('mongodb/document', {
				dbName : dbName,
				colName : colName,
				docId : docId,
				docString :  bson.toString(doc)
			});
		}
	});
};

exports.updateDocument = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	var docId = req.params.document;
	var doc = req.body.document;
	logger.debug('['+moduleName+'][updateDocument] dbName:'+dbName+', colName:'+colName+', docId:'+docId);

	if(doc == undefined || doc.length == 0) {
		logger.warn('['+moduleName+'][updateDocument] You forgot to enter a document!');
		res.json({ status: 403, message: 'You forgot to enter a document!' });
		return;
	}

	if(docId.length == 24) {
		//Convert id string to mongodb object ID
		try {
			docId = new mongodb.ObjectID.createFromHexString(docId);
		} catch (err) {
			logger.error('['+moduleName+'][updateDocument] Document ID convert error; ', err);
		}
	}

	var docBSON;
	try {
		docBSON = bson.toBSON(doc);
	} catch (err) {
		logger.warn('['+moduleName+'][updateDocument] That document is not valid!');
		res.json({ status: 403, message: 'That document is not valid!' });
		return;
	}

	docBSON._id = docId;
	var mongodb_url = getMongoDBUrl(dbName);
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.findOne({_id : docId}, function(err, doc) {
				col.update(doc, docBSON, {safe: true}, cb);
			});
		}
	], function(err, result) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][updateDocument] Something went wrong; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][updateDocument] result ok; ');
			res.json({ status: 200, message: 'OK', docString: bson.toString(docBSON) });
		}
	});
};

exports.deleteDocument = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	var docId = req.params.document;
	logger.debug('['+moduleName+'][deleteDocument] dbName:'+dbName+', colName:'+colName+', docId:'+docId);

	if(docId === '_all') {
		deleteAllDocuments(req, res);
		return;
	}

	if(docId.length == 24) {
		//Convert id string to mongodb object ID
		try {
			docId = new mongodb.ObjectID.createFromHexString(docId);
		} catch (err) {
			logger.error('['+moduleName+'][deleteDocument] Document ID convert error; ', err);
		}
	}

	var mongodb_url = getMongoDBUrl(dbName);
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.findOne({_id : docId}, function(err, doc) {
				col.remove(doc, {safe: true}, cb);
			});
		}
	], function(err, result) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][deleteDocument] Something went wrong; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][deleteDocument] result ok; ');
			res.json({ status: 200, message: 'OK' });
		}
	});
};

exports.deleteAllDocuments = function(req, res) {
	var dbName = req.params.database;
	var colName = req.params.collection;
	var docId = req.params.document;
	logger.debug('['+moduleName+'][deleteAllDocuments] dbName:'+dbName+', colName:'+colName);

	var mongodb_url = getMongoDBUrl(dbName);
	var _db;
	async.waterfall([
		function(cb) {
			mongoClient.connect(mongodb_url, cb);
		},
		function(db, cb) {
			_db = db;
			var col = db.collection(colName);
			col.remove({}, {safe: true}, cb);
		}
	], function(err, result) {
		_db && _db.close();
		if(err) {
			logger.error('['+moduleName+'][deleteAllDocuments] Something went wrong; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			logger.debug('['+moduleName+'][deleteAllDocuments] result ok; ');
			res.json({ status: 200, message: 'OK' });
		}
	});
};
