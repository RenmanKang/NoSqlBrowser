var async = require('async');
var path = require('path');
var fs = require('fs');
var cubrid = require('../lib/cubrid');
var conf = require('../config/config');
var utils = require('../lib/utils');
var logger = require('../lib/logger').appLogger;

exports.index = function(req, res) {
	logger.debug('Response cubrid tool page');
	var title = res.__i('title');
	var path = req.query.path || '/';
	res.render('cubrid', {
		layout: false,
		title: title,
		cubrid: conf.cubrid.host + ':' + conf.cubrid.port + '/' + conf.cubrid.dbname
	});
};

exports.getTableTrees = function(req, res) {
	var tname = req.query.srch || req.query.path;
	if(tname === '#') tname = null;
	logger.debug('getTableTrees::table:', tname);

	var list = [];
	var conn;
	async.waterfall([
		function(cb) {
			cubrid.pool.acquire(cb);
		},
		function(c, cb) {
			conn = c;
			if(tname) {
				logger.debug('getTableTrees::desc ['+tname+']');
				conn.query('desc ['+tname+']', cb);
			} else {
				logger.debug('getTableTrees::show tables');
				conn.query('show tables', cb);
			}
		},
		function(result, queryHandle, cb) {
			logger.debug('getTableTrees::Query results:', result);
			var data = JSON.parse(result);
			if (tname) {
				var cols = data.ColumnValues;
				cols.forEach(function (col) {
					logger.debug('col;', col);
					var val = col[0];
					list.push({
						id: tname + '/' + val,
						text: val,
						icon: '/img/icon/file-text2.png',
						children: false
					});
				});
			} else {
				var tables = data.ColumnValues;
				tables.forEach(function(table) {
					var val = table[0];
					list.push({
						id: val,
						text: val,
						icon: '/img/icon/table2.png',
						children: true
					});
				});
			}
			cb(null, queryHandle);
		},
		function(queryHandle, cb) {
			conn.closeQuery(queryHandle, cb);
			logger.debug('getTableTrees::Query closed.');
		}
	], function(err) {
		conn && cubrid.pool.release(conn);
		logger.debug('getTableTrees::Connection closed.');
		if(err) {
			logger.error('getTableTrees:: Process error; ',err);
		}
		res.json(list);
	});
};

exports.getTableInfo = function(req, res) {
	var tnames = req.query.tnames;

	if(!tnames) {
		res.json({ status: 404, message: 'Invalid table name'});
		return;
	}

	var arr = tnames.split('/');
	var tname = arr[0];
	var column = arr.length === 2 && arr[1];

	var info = {};
	var conn;
	async.waterfall([
		function(cb) {
			cubrid.pool.acquire(cb);
		},
		function(c, cb) {
			conn = c;
			if(column) { // show colume info
				conn.query('desc ['+tname+']', cb);
			} else {
				conn.query('show create table ['+tname+']', function(err, result, queryHandle) {
					if(err) {
						logger.warn('getTableInfo::show create table query error; ', err);
						conn.query('show create view ['+tname+']', cb);
					} else {
						cb(null, result, queryHandle);
					}
				});
			}
		},
		function(result, queryHandle, cb) {
			logger.debug('getTableInfo::Query results:', result);
			var data = JSON.parse(result);
			if(column) {
				var cols = data.ColumnValues;
				var cinfo;
				for(var i = 0; i < cols.length; i++) {
					var col = cols[i];
					if(col[0] === column) {
						cinfo = col;
						break;
					}
				}
				if(cinfo) {
					info = {
						type: 'COLUMN',
						name: cinfo[0],
						ctype: cinfo[1],
						is_null: cinfo[2],
						key: cinfo[3],
						default: cinfo[4],
						extra: cinfo[5]
					};
				}
			} else {
				var dtype = data.ColumnNames[0];
				var tables = data.ColumnValues[0];
				if(dtype === 'TABLE') {
					var t_name = tables[0];
					var t_info = tables[1];
					info = {
						type: 'TABLE',
						name: t_name,
						value: t_info
					}
				} else { // View
					var v_name = tables[0];
					var v_info = tables[1];
					info = {
						type: 'VIEW',
						name: v_name,
						value: v_info
					}
				}
			}
			cb(null, queryHandle);
		},
		function(queryHandle, cb) {
			conn.closeQuery(queryHandle, cb);
			logger.debug('getTableInfo::Query closed.');
		}
	], function (err) {
		conn && cubrid.pool.release(conn);
		logger.debug('getTableInfo::Connection closed.');
		if(err) {
			logger.error('getTableTrees:: Process error; ',err);
			res.json({ status: 500, message: err });
		} else {
			res.json({ status: 200, message: 'OK', data: info });
		}
	});
};

exports.getQueryResults = function(req, res) {
	var sql = req.body.sql;

	if(!sql) {
		res.json({ status: 404, message: 'No SQL statement'});
		return;
	}
	sql = sql.split(';')[0].trim();

	var data = {}, columnNames, columnDataTypes, columnValues = [];
	var conn;
	async.waterfall([
		function(cb) {
			cubrid.pool.acquire(cb);
		},
		function(c, cb) {
			conn = c;
			function handleResults(err, r, queryHandle) {
				if(err) {
					cb(err);
				} else if(r) {
					r = JSON.parse(r);
					!columnNames && (columnNames = r.ColumnNames);
					!columnDataTypes && (columnDataTypes = r.ColumnDataTypes);
					columnValues = columnValues.concat(r.ColumnValues);
					conn.fetch(queryHandle, handleResults);
				} else {
					conn.closeQuery(queryHandle, cb);
				}
			}
			conn.query(sql, handleResults);
		}
	], function (err) {
		conn && cubrid.pool.release(conn);
		logger.debug('getQueryResults::Connection closed.');
		if(err) {
			logger.error('getQueryResults::Process error; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			data = {
				ColumnNames: columnNames,
				ColumnDataTypes: columnDataTypes,
				RowsCount: columnValues.length,
				ColumnValues: columnValues
			};
			res.json({ status: 200, message: 'OK', data: data });
		}
	});
};

exports.getQueryHistory = function(req, res) {
	getQueryList(function(err, data) {
		if(!err) {
			res.json({ status: 200, message: 'OK', data: data} );
		} else {
			res.json({ status: 404, message: err });
		}
	});
};

exports.addQueryHistory = function(req, res) {
	var q = req.body.query;
	if(!q) {
		res.json({ status: 403, message: 'No data' });
		return;
	}

	async.waterfall([
		function(cb) {
			getQueryList(function(err, queries) {
				var list = [q];
				if(!err) {
					for(var i = 0; i < queries.length; i++) {
						if(queries[i] !== q) list.push(queries[i]);
					}
					if(list.length > 100) {
						list = list.slice(0, 100);
					}
				}
				cb(null, list);
			});
		},
		function(queries, cb) {
			saveQueryList(queries, function(err) {
				cb(err, queries);
			});
		}
	], function(err, queries) {
		if(err) {
			logger.error('addQueryHistory::Process error; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			res.json({ status: 200, message: 'OK', data: queries });
		}
	});
};

exports.removeQueryHistory = function(req, res) {
	var index = parseInt(req.params.index, 10);

	async.waterfall([
		function(cb) {
			getQueryList(function(err, queries) {
				var list = [];
				if(!err) {
					for(var i = 0; i < queries.length; i++) {
						if(i !== index) {
							list.push(queries[i]);
						}
					}
				}
				cb(null, list);
			});
		},
		function(queries, cb) {
			saveQueryList(queries, function(err) {
				cb(err, queries);
			});
		}
	], function(err, queries) {
		if(err) {
			logger.error('removeQueryHistory::Process error; ', err);
			res.json({ status: 500, message: utils.getErrMsg(err) });
		} else {
			res.json({ status: 200, message: 'OK', data: queries });
		}
	});
};

function getQueryFilePath () {
	return ((conf.backup && conf.backup.path) || __dirname + '/../config/')+'.cubrid-query';
}

function getQueryList(callback) {
	fs.readFile(getQueryFilePath(), 'utf8', function (err, data) {
		if(err) {
			logger.info('getQueryList::Query list read error;', err);
			callback(err);
		} else {
			try {
				var queries = JSON.parse(data);
				callback(null, queries);
			} catch(e) {
				logger.error('getQueryList::Query data parse error;', e);
				callback(e);
			}
		}
	});
}

function saveQueryList(queries, callback) {
	fs.writeFile(getQueryFilePath(), JSON.stringify(queries), function (err) {
		if(err) {
			logger.error('saveQueryList::Query save error;', err);
			callback(err);
		} else {
			callback(null);
		}
	});
}

