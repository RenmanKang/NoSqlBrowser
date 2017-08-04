/*
 * dispatch.js
 */

/**
 * init all paths
 */
var routes = require('./config/routes');

/**
 * register request processor
 */
exports.dispatch = function(app) {
	routes.forEach(function(route) {
		var handler_module = require(route.path);
		app[route.method](route.url, processReq(handler_module[route.fn]));
	});

};

var processReq = function(processor) {
	return function(req, res, next) {
		processor(req, res, next);
	};
};
