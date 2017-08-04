'use strict';

var url = require('url');
var RedisDump = require('node-redis-dump');
var redisConnections = require('./index').redisConnections;
var conf = require('../../config/config');
var logger = require('../../lib/logger').appLogger;

/**
 * Make dump by redis database.
 */
exports.redisExport = function(req, res) {
	var urlParams = url.parse(req.url, true).query,
		connection = urlParams.connection.split(':'),
		connectionId = 0;

	if(!connection[0]) {
		connection = [ conf.redis.host, conf.redis.port+'', '0' ];
	}

	for(var i in redisConnections) {
		if (redisConnections[i].connection_options.host === connection[0]
				&& redisConnections[i].connection_options.port === connection[1]
				&& redisConnections[i].selected_db === connection[2]) {
			connectionId = i;
			break;
		}
	}

	var client = redisConnections[ connectionId ];
	logger.debug('redisExport:: Starting redis export; ', client);
	var dump = new RedisDump({ client: client });

	var type = urlParams.type || 'redis';
	dump.export({
		type: type,
		callback: function(err, data) {
			if (err) {
				logger.error('redisExport::Could\'t not make redis dump!', err);
				return;
			}

			res.setHeader('Content-disposition', 'attachment; filename=redis-db.' + (new Date().getTime()) + '.'+type);
			res.setHeader('Content-Type', 'application/octet-stream');
			switch (type) {
				case 'json':
					res.end(JSON.stringify(data));
					break;
				default:
					res.end(data);
					break;
			}
		}
	});
}

/**
 * Import redis data.
 */
exports.redisImport = function(req, res) {
	var connection = req.body.connection.split(':'),
		connectionId = 0;

	if (!connection[0]) {
		connection = [ conf.redis.host, conf.redis.port+'', '0' ];
	}

	for (var i in redisConnections) {
		if (redisConnections[i].connection_options.host === connection[0]
				&& redisConnections[i].connection_options.port === connection[1]
				&& redisConnections[i].selected_db === connection[2]) {
			connectionId = i;
			break;
		}
	}

	var client = redisConnections[ connectionId ];
	logger.debug('redisExport:: Starting redis import; ', client);
	var dump = new RedisDump({ client: client });

	dump.import({
		type: 'redis',
		data: req.body.data,
		clear: req.body.clear,
		callback: function(err, report) {
			report.status = 200;
			if(err) {
				report.status = 500;
				report.message = report.errors;
				logger.error('Could\'t not import redis data!', err);
			}
			res.json(report);
		}
	});
}
