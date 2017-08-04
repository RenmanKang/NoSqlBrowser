var async = require('async');
var cubrid = require('node-cubrid');
var generic_pool = require('generic-pool');
var dbConfig = require('../config/config').cubrid;
var logger = require('./logger').appLogger;

var db = module.exports = {};
var Result2Array = db.Result2Array = cubrid.Result2Array;

var poolFactory = {
		name: 'cubrid-node-pool',
		max: dbConfig.max_connection || 10,
		min: dbConfig.min_connection || 0,
		idleTimeoutMillis: dbConfig.idleTimeoutMillis || 30000,
		create: function (cb) {
			var conn = cubrid.createConnection({
				host: dbConfig.host,
				port: dbConfig.port,
				user: dbConfig.user,
				password: dbConfig.password,
				database: dbConfig.dbname,
				connectionTimeout: dbConfig.connectionTimeout
			});

			conn.connect(function (err) {
				cb(err, conn);
			});
		},
		destroy: function (conn) {
			if (conn && typeof conn === 'object') {
				conn.close(function (err) {
					if (err) {
						logger.error("cubrid close err is " + err.toString());
					}
				});
			}
		},
		priorityRange: 3,
		// `returnToHead` boolean, if true the most recently released
		// resources will be the first to be allocated. This in effect
		// turns the pool's behaviour from a queue into a stack.
		// Optional (default false).
		returnToHead: true,
		validate: function (conn) {
			return conn && typeof conn === 'object';
		},
		log: function (info) {
			//logger.debug('CUBRID_POOL', info);
		}
	},
	pool = db.pool = generic_pool.Pool(poolFactory);

// Fetch all records matching the SQL query.
// Should be called after `query()` function, i.e. when the first batch of results
// and `queryHandle` is received.
db.fetchAll = fetchAll;
db.fetchAllAsObjects = fetchAllAsObjects;
db.fetchRawValues = fetchRawValues;
db.queryObjects = queryObjects;
db.Helpers = cubrid.Helpers;
db.ActionQueue = cubrid.ActionQueue;

db.batchInsertWithConnection = batchInsertWithConnection;
db.pool.execute = execute;

/**
 * query db
 *
 * @param {String}
 *            sql sql String
 * @param {Function}
 *            callback function with parameters results and fields
 */
db.query = function (sql, cb) {
	try {
		pool.acquire(function (err, client) {
			if (err) {
				logger.error("[query] errro: " + err.toString());

				cb(err, [], []);
				return;
			}

			sql = quoteSpecialWords(sql);

			logger.debug("[query] start query: %s.", sql);

			client.query(sql, function (err, result, queryHandle) {
				processQueryResult(client, cb, err, result, queryHandle);
			});
		});
	} catch(e) {
		logger.error("acquire db connection failed. when excuting %s", sql);
		cb(e, [], []);
	}
};

/**
 * query database with params
 *
 * @param {String}
 *            sql sql query
 * @param {Array}
 *            arrParamsValues values in array
 * @param {Array}
 *            arrDelimiters delimiters in array
 * @param {Function}
 *            cb callback function (err,result,queryHandle)
 */
db.queryWithParams = function (sql, arrParamsValues, arrDelimiters, cb) {
	pool.acquire(function (err, client) {
		if (err) {
			cb(err);
		} else {
			sql = quoteSpecialWords(sql);

			logger.debug("[queryWithParams] start query: %s, values are: %s, delimiters are: %s", sql, arrParamsValues, arrDelimiters);

			client.queryWithParams(sql, arrParamsValues, arrDelimiters, function (err, result, queryHandle) {
				processQueryResult(client, cb, err, result, queryHandle);
			});
		}
	});
};

var processQueryResult = function (client, cb, err, result, queryHandle) {
	logger.debug("[processQueryResult] process query");

	if (err) {
		client && pool.release(client);
		logger.error("[query] error query, err is " + err.toString());
		cb(err, [], []);
		return;
	}

	var queryResult = [];
	var fields = Result2Array.ColumnNamesArray(result);

	function outputResults(err, result, queryHandle) {
		if (err && err != "Error: -1012:CAS_ER_NO_MORE_DATA") {
			logger.error("[query] query error, err is " + err);

			cb(err, [], []);
			_closeClient(client, queryHandle);

			return;
		} else {
			if (result) {
				var sr = convertResult2MysqlWithColumn(fields, result);
				for (var i = 0; i < sr.length; i++) {
					queryResult.push(sr[i]);
				};

				client.fetch(queryHandle, outputResults);
			} else {
				cb(null, queryResult, fields);

				_closeClient(client, queryHandle);
			}
		}
	}

	outputResults(err, result, queryHandle);
};

// close current client
var _closeClient = function (client, queryHandle, cb) {
	client.closeQuery(queryHandle, function (err) {
		pool.release(client);
		cb && cb(err);
	});
};

var convertResult2MysqlWithColumn = function (ColumnNamesArray, result) {
	var fieldArray = ColumnNamesArray;
	var resultArray = Result2Array.RowsArray(result);
	var sqlResultArray = [];

	if (!fieldArray || !resultArray) {
		return [];
	}

	for (var i = 0; i < resultArray.length; i++) {
		sqlResultArray.push({});
		for (var j = 0; j < fieldArray.length; j++) {
			var key = fieldArray[j];
			var value = resultArray[i][j];
			sqlResultArray[sqlResultArray.length - 1][key] = value;
		}
	}

	return sqlResultArray;
};

var quoteSpecialWords = function (sql) {
	// sql = sql.toLowerCase();
	var quoteWords = function (str) {
		var sql = str;
		var specialWords = ["count", "COUNT", "user", "USER", "sys_user", "SYS_USER", "role", "ROLE", "position", "POSITION"];
		for (var i = 0; i < specialWords.length; i++) {
			var word = specialWords[i];
			var index = -word.length - 1;
			while ((index = sql.indexOf(word, index + 1 + word.length)) !== -1) {
				var preChar = " ";

				if (index > 0) {
					preChar = sql.charAt(index - 1);
				}

				var postChar = " ";

				if (index < sql.length - 1) {
					postChar = sql.charAt(index + word.length);
				}

				var specialChars = " ,=.";

				if (specialChars.indexOf(preChar) != -1 && specialChars.indexOf(postChar) != -1) {
					sql = sql.substring(0, index) + "\"" + word + "\"" + sql.substring(index + word.length);
				}
			}
		}
		return sql;
	};

	var beginIndex = sql.length;
	var endIndex = -1;
	var translateDelimiters = "\"";

	for (var i = 0; i < translateDelimiters.length; i++) {
		var index = sql.indexOf(translateDelimiters[i]);

		if (index != -1 && index < beginIndex) {
			beginIndex = index;
		}

		index = sql.lastIndexOf(translateDelimiters[i]);

		if (index != -1 && index > endIndex) {
			endIndex = index;
		}
	}

	if (beginIndex >= endIndex) {
		sql = quoteWords(sql);
	} else {
		var beginPart = sql.substring(0, beginIndex);
		var middlePart = sql.substring(beginIndex, endIndex);
		var endPart = sql.substring(endIndex);
		sql = quoteWords(beginPart) + middlePart + quoteWords(endPart);
	}

	logger.debug("[quoteSpecialWords] [Complete] quote special words complete sql is:%s", sql);
	return sql;
};

// Fetch all records matching the SQL query.
function fetchAll(conn, queryHandle, result, callback) {
	conn.fetch(queryHandle, function (err, fetchResult, queryHandle) {
		if (err) {
			callback(err);
		} else {
			if (fetchResult) {
				fetchResult = JSON.parse(fetchResult);
				result.ColumnValues = result.ColumnValues.concat(fetchResult.ColumnValues);

				fetchAll(conn, queryHandle, result, callback);
			} else {
				// Close the query.
				conn.closeQuery(queryHandle, function () {
					var collection = [];

					if (result) {
						result.ColumnValues.forEach(function (values) {
							var record = {};

							for (var i = result.ColumnNames.length - 1; i > -1; --i) {
								record[result.ColumnNames[i]] = values[i];
							}

							collection.push(record);
						});
					}

					callback(null, collection);
				});
			}
		}
	});
}

function fetchRawValues(sql, params, cb) {
	if (typeof params === 'function') {
		cb = params;
		params = undefined;
	}

	var conn, result = [];

	async.waterfall([
		function (cb) {
			pool.acquire(cb);
		},
		function (c, cb) {
			conn = c;

			conn.query(sql, params, function handleResults(err, r, queryHandle) {
				if (err) {
					cb(err);
				} else if (r) {
					result = result.concat(JSON.parse(r).ColumnValues);

					conn.fetch(queryHandle, handleResults);
				} else {
					conn.closeQuery(queryHandle, cb);
				}
			});
		}
	], function (err) {
		conn && pool.release(conn);

		cb(err, result);
	});
}

function fetchAllAsObjects(sql, params, cb) {
	if (typeof params === 'function') {
		cb = params;
		params = undefined;
	}

	var conn, result = [], columnNames;

	async.waterfall([
		function (cb) {
			pool.acquire(cb);
		},
		function (c, cb) {
			conn = c;

			conn.query(sql, params, function handleResults(err, r, queryHandle) {
				if (err) {
					cb(err);
				} else if (r) {
					r = JSON.parse(r);
					!columnNames && (columnNames = r.ColumnNames);
					result = result.concat(r.ColumnValues);

					conn.fetch(queryHandle, handleResults);
				} else {
					conn.closeQuery(queryHandle, cb);
				}
			});
		},
		function (queryHandle, cb) {
			var collection = [];

			if (result) {
				var columnsCount = columnNames.length;

				result.forEach(function (values) {
					var record = {};

					for (var i = 0; i < columnsCount; ++i) {
						record[columnNames[i]] = values[i];
					}

					collection.push(record);
				});

				result = collection;
			}

			cb();
		}
	], function (err) {
		conn && pool.release(conn);

		cb(err, result);
	});
}

function queryObjects(sql, params, cb) {
	if (typeof params === 'function') {
		cb = params;
		params = undefined;
	}

	var conn, result;

	async.waterfall([
		function (cb) {
			pool.acquire(cb);
		},
		function (c, cb) {
			conn = c;

			conn.query(sql, params, cb);
		},
		function (r, queryHandle, cb) {
			result = Result2Array.ObjectsArray(r);

			conn.closeQuery(queryHandle, cb);
		}
	], function (err) {
		conn && pool.release(conn);

		cb(err, result);
	});
}

function batchInsertWithConnection(conn, sql, values, cb) {
	var batchSize = 100,
		i = 0,
		len = values.length;

	async.whilst(function () {
		return i < len;
	}, function (cb) {
		async.waterfall([
			function (cb) {
				conn.batchExecuteNoQuery([sql + values.slice(i, i + batchSize).join()], cb);
			},
			function (cb) {
				i += batchSize;

				cb();
			}
		], cb);
	}, cb);
}

function execute(sqls, params, cb) {
	if (typeof params === 'function') {
		cb = params;
		params = undefined;
	}

	var conn;

	async.waterfall([
		function (cb) {
			db.pool.acquire(cb);
		},
		function (c, cb) {
			conn = c;

			if (params) {
				conn.executeWithParams(sqls, params, [], cb);
			} else {
				conn.batchExecuteNoQuery(sqls, cb);
			}
		}
	], function (err) {
		conn && db.pool.release(conn);

		cb(err);
	});
}
