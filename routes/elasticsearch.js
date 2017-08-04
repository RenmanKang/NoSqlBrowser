var _ = require('underscore'),
	http = require("http"),
	url = require('url'),
	elasticsearch = require('elasticsearch'),
	conf = require('../config/config'),
	bson = require('../lib/bson'),
	utils = require('../lib/utils'),
	logger = require('../lib/logger').appLogger;

var moduleName = utils.getFileName(module.filename);

var esConf = conf.elasticsearch;
var esCli = elasticsearch.Client({
	host: 'http://' + esConf.user + ':' + esConf.password + '@' + esConf.host + ':' + esConf.port,
	apiVersion: esConf.apiVersion,
	log: 'error'
});

exports.index = function(req, res) {
	logger.debug('Response es browser tool page');
	var title = res.__i('title');
	res.render('elasticsearch/index', {
		title: title,
		server: esConf.host + ':' + esConf.port
	});
};

exports.getClusterHealth = function(req, res) {
	logger.debug('['+moduleName+'][getClusterStats] get cluster stats');
	esCli.cluster.health({
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getClusterStats] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getClusterStats] es response error; ', err);
			res.json({status: status, message: err.toString()});
		} else {
			res.json({status: status, c_name: body.cluster_name, c_status: body.status, data: bson.toString(body)});
		}
	});
};
exports.getClusterStats = function(req, res) {
	logger.debug('['+moduleName+'][getClusterStats] get cluster stats');
	esCli.cluster.stats({
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getClusterStats] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getClusterStats] es response error; ', err);
			res.json({status: status, message: err.toString()});
		} else {
			res.json({status: status, c_name: body.cluster_name, c_status: body.status, data: bson.toString(body)});
		}
	});
};
exports.getClusterState = function(req, res) {
	logger.debug('['+moduleName+'][getClusterState] get cluster state');
	esCli.cluster.state({
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getClusterState] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getClusterState] es response error; ', err);
			res.json({status: status, message: err.toString()});
		} else {
			res.json({status: status, c_name: body.cluster_name, data: bson.toString(body)});
		}
	});
};

exports.getEsTree = function(req, res) {
	var index = req.query.index;
	if(!index || index === '#') {
		getIndexTree(function (err, tree) {
			res.json(tree);
		});
	} else if(index === 'Templates') {
		getTemplateTree(function(err, tree) {
			res.json(tree);
		})
	} else {
		getTypeTree(index, function(err, tree) {
			res.json(tree);
		});
	}
};

var getIndexTree = function(cb) {
	logger.debug('['+moduleName+'][getIndexTree] get index tree');

	var cluster = {
		id: 'cluster',
		text: 'cluster',
		icon: 'glyphicon glyphicon-home',
		a_attr: { role: 'cluster' },
		children: []
	};

	esConf.indexGroup.forEach(function(group) {
		cluster.children.push({
			id: new Buffer(group.name).toString('base64').replace(/[=]/g, '_'),
			text: group.name,
			icon: 'glyphicon glyphicon-folder-close',
			a_attr: { role: 'group' },
			children: []
		});
	});
	var etc = {
		id: 'etc',
		text: 'etc',
		icon: 'glyphicon glyphicon-folder-close',
		a_attr: { role: 'group' },
		children: []
	};
	var template = {
		id: 'Templates',
		text: 'Templates',
		icon: 'glyphicon glyphicon-folder-close',
		a_attr: { role: 'group' },
		children: true
	};

	esCli.cluster.health({
		level: 'indices'
	}, function(err, body, status) {
		logger.debug('['+moduleName+'][getIndexTree] es response status; %s', status);
		if(err) {
			logger.error('['+moduleName+'][getIndexTree] es response error; ', err);
		} else {
			cluster.id = body.cluster_name;
			cluster.text = body.cluster_name;
			var indices = Object.keys(body.indices).sort().reverse();
			indices.forEach(function (index) {
				var child = {
					id: new Buffer(index).toString('base64').replace(/[=]/g, '_'),
					text: index,
					icon: '/img/icon/database.png',
					a_attr: { role: 'index' },
					children: true
				};
				var isSet = esConf.indexGroup.some(function(group, idx) {
					if(index.indexOf(group.prefix) === 0) {
						cluster.children[idx].children.push(child);
						return true;
					} else {
						return false;
					}
				});
				!isSet && etc.children.push(child);
			});
		}
		cluster.children.push(etc);
		cluster.children.push(template);
		cb(null, [cluster]);
	});
};

var getTypeTree = function(index, cb) {
	var tree = [];
	esCli.indices.getMapping({
		index: index
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getTypeTree] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getTypeTree] es response error; ', err);
		} else {
			var types = Object.keys(body[index].mappings).sort();
			types.forEach(function(type) {
				type !== '_default_' && tree.push({
					id: new Buffer(index).toString('base64').replace(/[=]/g, '_')+'__'+new Buffer(type).toString('base64').replace(/[=]/g, '_'),
					text: type,
					icon: '/img/icon/table2.png',
					a_attr: { role: 'type', parent: index },
					children: false
				});
			});
		}
		cb(null, tree);
	});
};

var getTemplateTree = function(cb) {
	var tree = [];
	esCli.indices.getTemplate({

	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getTemplateTree] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getTemplateTree] es response error; ', err);
		} else {
			var temps = Object.keys(body).sort();
			temps.forEach(function(temp) {
				tree.push({
					id: 'tree_temp__'+new Buffer(temp).toString('base64').replace(/[=]/g, '_'),
					text: temp,
					icon: '/img/icon/embed2.png',
					a_attr: { role: 'template' },
					children: false
				});
			});
		}
		cb(null, tree);
	});
};

exports.createIndex = function(req, res) {
	var index = req.params.index;
	logger.debug('['+moduleName+'][createIndex] Create index: %s', index);
	esCli.indices.create({
		index: index
	}, function(err, body, status) {
		if(err) {
			logger.error('[' + moduleName + '][createIndex] es response error; ', err);
			res.json({status: status, message: utils.getErrMsg(err)});
		} else {
			res.json({status: status, message: body});
		}
	});
};

exports.deleteIndex = function(req, res) {
	var index = req.params.index;
	logger.debug('['+moduleName+'][deleteIndex] Delete index: %s', index);
	esCli.indices.delete({
		index: index
	}, function(err, body, status) {
		if(err) {
			logger.error('[' + moduleName + '][deleteIndex] es response error; ', err);
			res.json({status: status, message: utils.getErrMsg(err)});
		} else {
			res.json({status: status, message: body});
		}
	});
};

exports.listDocument = function(req, res) {
	var indices = req.params.indices;
	var types = req.params.types;
	var from = parseInt(req.query.from || 0);
	var size = parseInt(req.query.size || 50);

	var opts = {
		index: indices,
		body: {
			"query":{"match_all":{}},
			"sort":[ {"logTime":{"order":"desc","ignoreUnmapped":true}} ]
		},
		from: from,
		size: size,
		ignore_unavailable: true
	};
	if(types) {
		opts.type = types;
		//opts.routing = type;
	}

	var t_idx = new Buffer(indices).toString('base64').replace(/[=]/g, '_');
	var tabId = types ? 'type__'+t_idx+'__'+new Buffer(types).toString('base64').replace(/[=]/g, '_') : 'idx__'+t_idx;
	var ctx = {
		tabId: tabId,
		from: from,
		size: size
	};

	esCli.search(opts, function (err, body, status) {
		logger.debug('[' + moduleName + '][listDocument] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][listDocument] es response error; ', err);
			ctx.documents = err.toString();
//			res.json({status: status, message: err.toString()});
		} else {
			ctx.documents = bson.toString(body);
//			res.json({status: status, data: bson.toString(body)});
		}
		res.render('elasticsearch/browse', ctx);
	});
};

exports.searchDocument = function(req, res) {
	var indices = req.params.indices;
	var types = req.params.types;
	var body = req.body;

	var opts = req.query || {};
	opts.index = indices;
	opts.ignore_unavailable = true;
	if(types) {
		opts.type = types;
//		opts.routing = types;
	}
	body && (opts.body = body);

	esCli.search(opts, function (err, body, status) {
		logger.debug('[' + moduleName + '][searchDocument] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][searchDocument] es response error; ', err);
			res.json({status: status, message: err.toString()});
		} else {
			res.json({status: status, data: bson.toString(body)});
		}
	});
};

exports.addDocument = function(req, res) {
	var index = req.params.index;
	var doc = req.body.document;

	logger.debug('['+moduleName+'][addDocument] index: '+index);

	if(doc == undefined || doc.length == 0) {
		logger.warn('['+moduleName+'][addDocument] You forgot to enter a document!');
		res.json({ status: 400, message: 'You forgot to enter a document!' });
		return;
	}

	try {
		var obj = bson.toBSON(doc);
		obj.index = index;

		if(!obj.type || obj.type.length === 0) {
			logger.error('['+moduleName+'][addDocument] Unable to build a path with those params. Supply at least index, type');
			res.json({ status: 400, message: 'Unable to build a path with those params. Supply at least index, type' });
			return;
		}

		if(!obj.body || obj.body.length === 0) {
			logger.error('['+moduleName+'][addDocument] document is empty');
			res.json({ status: 400, message: 'document is empty' });
			return;
		}

		esCli.create(obj, function (err, body, status) {
			logger.debug('[' + moduleName + '][addDocument] es response status; %s', status);
			if(err) {
				logger.error('[' + moduleName + '][addDocument] es response error; ', err);
				res.json({status: status, message: err.toString()});
			} else {
				res.json({status: status, data: bson.toString(body)});
			}
		});
	} catch(err) {
		logger.error('['+moduleName+'][addDocument] That document is not valid!', err);
		res.json({ status: 400, message: 'That document is not valid!' });
	}
};

exports.getIndexStatus = function(req, res) {
	var indices = req.params.indices;
	var tabId = req.query.tabId;
	var ctx = {
		tabId: tabId
	};
	esCli.indices.status({
		index: indices
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getIndexStatus] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getIndexStatus] es response error; ', err);
			ctx.info = utils.getErrMsg(err);
		} else {
			ctx.info = bson.toString(body);
		}
		res.render('elasticsearch/info', ctx);
	});
};
exports.getIndexStats = function(req, res) {
	var indices = req.params.indices;
	var tabId = req.query.tabId;
	var ctx = {
		tabId: tabId
	};
	esCli.indices.stats({
		index: indices
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getIndexStats] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getIndexStats] es response error; ', err);
			ctx.info = utils.getErrMsg(err);
		} else {
			ctx.info = bson.toString(body);
		}
		res.render('elasticsearch/info', ctx);
	});
};

exports.getTemplate = function(req, res) {
	var template = req.params.template;
	var tabId = req.query.tabId;
	var ctx = {
		tabId: tabId
	};
	var opts = {};
	template && (opts.name = template);
	esCli.indices.getTemplate(opts, function(err, body, status) {
		logger.debug('[' + moduleName + '][getTemplate] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getTemplate] es response error; ', err);
			ctx.info = utils.getErrMsg(err);
		} else {
			ctx.info = bson.toString(body);
		}
		res.render('elasticsearch/info', ctx);
	});
};
exports.putTemplate = function(req, res) {
	var status = 200;
	var message = 'ok';
	res.json({status: status, message: message});
};
exports.deleteTemplate = function(req, res) {
	var status = 200;
	var message = 'ok';
	res.json({status: status, message: message});
};

exports.getIndexMapping = function(req, res) {
	var indices = req.params.indices;
	var tabId = req.query.tabId;
	var ctx = {
		tabId: tabId
	};
	esCli.indices.getMapping({
		index: indices
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getIndexMapping] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getIndexMapping] es response error; ', err);
			ctx.info = utils.getErrMsg(err);
		} else {
			ctx.info = bson.toString(body);
		}
		res.render('elasticsearch/info', ctx);
	});
};
exports.putIndexMapping = function(req, res) {
	var status = 200;
	var message = 'ok';
	res.json({status: status, message: message});
};
exports.deleteIndexMapping = function(req, res) {
	var status = 200;
	var message = 'ok';
	res.json({status: status, message: message});
};

exports.getIndexAlias = function(req, res) {
	var indices = req.params.indices;
	var tabId = req.query.tabId;
	var ctx = {
		tabId: tabId
	};
	esCli.indices.getAlias({
		index: indices
	}, function(err, body, status) {
		logger.debug('[' + moduleName + '][getIndexAlias] es response status; %s', status);
		if(err) {
			logger.error('[' + moduleName + '][getIndexAlias] es response error; ', err);
//			res.json({status: status, message: err.toString()});
			ctx.info = utils.getErrMsg(err);
		} else {
			var result = {};
			var idxs = Object.keys(body).sort();
			idxs.forEach(function(idx) {
				var alias = Object.keys(body[idx].aliases);
				alias && alias.length && (result[idx] = alias);
			});
//			res.json({status: status, data: bson.toString(result)});
			ctx.info = bson.toString(result);
		}
		res.render('elasticsearch/info', ctx);
	});
};
exports.putIndexAlias = function(req, res) {
	var status = 200;
	var message = 'ok';
	res.json({status: status, message: message});
};
exports.deleteIndexAlias = function(req, res) {
	var status = 200;
	var message = 'ok';
	res.json({status: status, message: message});
};
