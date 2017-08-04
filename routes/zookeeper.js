var _ = require('underscore');
var path = require('path');
var conf = require('../config/config');
var ZkClient = require('../lib/zk.js').ZkClient;
var logger = require('../lib/logger').appLogger;

var zkClients = [];
var zk_hosts = conf.zookeeper.hosts.split(',');

exports.index = function(req, res) {
	logger.debug('[zookeeper.index] Response zookeeper tool page');
	var title = res.__i('title');
	var path = req.query.path || '/';
	res.render('zookeeper', {
		layout: false,
		title: title,
		hosts: zk_hosts,
		path: path,
		user: req.session.zk_user
	});
}

exports.login = function(req, res) {
	var user = req.body.zk_user;
	var pass = req.body.zk_pass;

	logger.debug('[zookeeper.login] login user:'+user+', pass:'+pass);
	if(conf.zookeeper.auth === (user + ':' + pass)) {
		req.session.zk_user = user;
		req.session.cookie.maxAge = 60*60*1000;
		res.json({ status: 200, message: 'Login ok', user: req.session.zk_user });
	} else {
		res.json({ status: 401, message: 'Login failed'});
	}
}

function getZkClient(zk_host) {
	//var zkclient = new ZkClient(zk_host);
	if(zk_hosts.indexOf(zk_host) === -1) {
		return null;
	} else {
		if(!zkClients[zk_host]) {
			var sync = true;
			zkClients[zk_host] = new ZkClient(zk_host);
			zkClients[zk_host].zk.add_auth(conf.zookeeper.scheme, conf.zookeeper.auth, function(rc, err) {
				if (rc !== 0) {
					logger.error('[zookeeper.getZkClient] Zookeeper auth error; code:' + rc, err);
				}
				sync = false;
			});
			// convert async to sync
			while(sync) {
				require('deasync').runLoopOnce();
			}
		}
		return zkClients[zk_host];
	}
}
exports.getPathTrees = function(req, res) {
	var zk_host = req.query.host || zk_hosts[0];
	var zkclient = getZkClient(zk_host);

	if(zkclient === null) {
		logger.error('[zookeeper.getPathTrees] zk host not found; ', zk_host);
		res.json([]);
		return;
	}

	var srchPath = req.query.srch;
	var zkPath = req.query.path;
	logger.debug('[zookeeper.getPathTrees] Tree path; ', zkPath);
	logger.debug('[zookeeper.getPathTrees] Tree search path; ', srchPath);

	if(!zkPath || zkPath === '#') {
		zkPath = srchPath || '/';
		logger.debug('[zookeeper.getPathTrees] Tree parent path; ', zkPath);
	}

	zkclient.zk.a_get_children(zkPath, null, function(rc, err, children) {
		var result = [];
		if(rc === 0) {
			logger.debug('[zookeeper.getPathTrees] Tree result:', children);
			children.forEach(function(child) {
				var realPath = path.join(zkPath, child);
				result.unshift({
					id: realPath,
					text: child,
					children: true
				});
			});
			result = _.sortBy(result, 'text');
		} else {
			logger.error('[zookeeper.getPathTrees] Zookeeper path children select error; code:' + rc, err);
		}
		res.json(result);
	});
}

exports.getPathInfo = function(req, res) {
//	var zk_host = conf.zookeeper.hosts;
//	var zkclient = new ZkClient(zk_host);
	var zk_host = req.query.host || zk_hosts[0];
	var zkclient = getZkClient(zk_host);
	var path = req.query.path || '/';

	if(zkclient === null) {
		logger.error('[zookeeper.getPathInfo] zk host not found; ', zk_host);
		res.json({
			status: 404,
			message: 'zk host not found',
			path: path,
			user: req.session.zk_user
		});
		return;
	}

	zkclient.zk.a_get(path, null, function(rc, err, stat, data) {
		res.header('Content-Type', 'application/json');
		if(rc != 0) {
			logger.error('[zookeeper.getPathInfo] Zookeeper path info select error; code:'+rc, err);
			res.json({
				status: 401,
				message: err,
				path: path,
				user: req.session.zk_user
			});
		} else {
			var dataStr = trimBuffer(data);
			logger.debug('[zookeeper.getPathInfo] zk data:', dataStr);
			res.json({
				status: 200,
				path: path,
				stat: stat,
				data: dataStr,
				user: req.session.zk_user
			});
		}
	});
}

function trimBuffer(data) {
	var dataStr = data ? data.toString() : '';
	var off = dataStr.indexOf('\u0000');
	if(off != -1) dataStr = dataStr.substring(0, off);
	return dataStr;
}

exports.createPath = function(req, res) {
	if(req.session.zk_user) {
		var zk_host = req.body.host || zk_hosts[0];
		var zkclient = getZkClient(zk_host);

		if(zkclient === null) {
			logger.error('[zookeeper.createPath] zk host not found; ', zk_host);
			res.json({
				status: 404,
				message: 'zk host not found'
			});
			return;
		}

		var path = req.body.path;
		var data = req.body.data;
		var flag = Number(req.body.flag);
		zkclient.zk.a_create(path, data, flag, function(rc, err, path) {
			if(rc != 0) {
				logger.error('[zookeeper.createPath] Zookeeper path create error; code: ' + rc, err);
				res.json({ status: 400, message: err });
			} else {
				logger.debug('[zookeeper.createPath] Successfully path('+path+') created');
				res.json({ status: 200, message: 'Successfully path('+path+') created'});
			}
		});
	} else {
		res.json({ status: 401, message: 'Please logon'});
	}
}

exports.editPath = function(req, res) {
	if(req.session.zk_user) {
//		var zk_host = conf.zookeeper.hosts;
//		var zkclient = new ZkClient(zk_host);
		var zk_host = req.body.host || zk_hosts[0];
		var zkclient = getZkClient(zk_host);

		if(zkclient === null) {
			logger.error('[zookeeper.editPath] zk host not found; ', zk_host);
			res.json({
				status: 404,
				message: 'zk host not found'
			});
			return;
		}

		var path = req.body.path;
		var new_data = req.body.new_data;
		var version = Number(req.body.version);
		zkclient.zk.a_set(path, new_data, version, function(rc, err, stat) {
			if(rc != 0) {
				logger.error('[zookeeper.editPath] Zookeeper path edit error; code: ' + rc, err);
				res.json({ status: 400, message: err });
			} else {
				logger.debug('[zookeeper.editPath] Successfully edited zookeeper path info; ', stat);
				res.json({ status: 200, message: 'Successfully edited'});
			}
		});
	} else {
		res.json({ status: 401, message: 'Please logon'});
	}
}

exports.deletePath = function(req, res) {
	if(req.session.zk_user) {
		var zk_host = req.body.host || zk_hosts[0];
		var zkclient = getZkClient(zk_host);

		if(zkclient === null) {
			logger.error('[zookeeper.deletePath] Can\'t delete zookeeper path('+path+'). zookeeper host not found; ', zk_host);
			res.json({
				status: 404,
				message: 'zk host not found'
			});
			return;
		}

		var path = req.body.path;
		var version = Number(req.body.version);
		zkclient.zk.a_delete_(path, version, function(rc, err) {
			if(rc != 0) {
				logger.error('[zookeeper.deletePath] Zookeeper path('+path+') delete error; code: ' + rc, err);
				res.json({ status: 400, message: err });
			} else {
				logger.debug('[zookeeper.deletePath] Successfully deleted zookeeper path;', path);
				res.json({ status: 200, message: 'Delete ok'});
			}
		});
	} else {
		logger.info('[zookeeper.deletePath] Can\'t delete zookeeper path('+path+'). Login required');
		res.json({ status: 401, message: 'Please logon'});
	}
}
