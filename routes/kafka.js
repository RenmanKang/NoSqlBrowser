var async = require('async');
var _ = require('underscore');
var kafka = require('kafka-node');
var ZkClient = require('../lib/zk.js').ZkClient;
var conf = require('../config/config');
var logger = require('../lib/logger').appLogger;

/**
 * Broker : /brokers/ids/{BrokerNo}
 * 	{"jmx_port":-1,"timestamp":"1430375110955","host":"112.175.29.39","version":1,"port":9092}
 *
 * Leader : Topic의 각 partition이 위치한 {BrokerNo}
 *  참고] http://epicdevs.com/17
 *      Replication factor를 N으로 설정할 경우 N개의 replica는 1개의 leader와 N-1개의 follower로 구성됨.
 *  	각 partition에 대한 읽기와 쓰기는 모두 leader에서 이루어지며, follower는 단순히 leader를 복제함.
 * 	/brokers/topics/{topicName}/partitions/{partitionNo}/state.leader
 * 	{"controller_epoch":45,"leader":0,"version":1,"leader_epoch":45,"isr":[0]}
 *
 * Offset :
 *   consumers/{consumerGroup}/offsets/{topicName}/{partitionNo}.getData()
 *   kafka spac(https://cwiki.apache.org/confluence/display/KAFKA/Kafka+data+structures+in+Zookeeper)에 따르면 consumer offset은 long 값으로 저장되나
 *   현재 elasticsearch가 사용하는 conssumer group인 river의 경우 {"offset":65751,"timestamp":"2015-05-10 18:22:03"} 형태로 저장됨
 *
 * LogSize : Topic의 각 partition에 존재하는 maxOffset 값
 *  brokers/topics/{topicName}/partitions-offsets/{partitionNo}/{lastDate}.getData().maxOffset
 * 	{"minOffset":"1311990","maxOffset":"1314744","count":"2754","timestamp":"2015-05-10 16:44:13"}
 *
 * Lag : consumer가 가져간 마지막 offset 값과 topic의 현재 offset 값의 차이. LogSize - Offset
 *
 * Monitoring
 * 	consumer group 내의 topic 별로 LogSize, Offset, Lag 값의 변화 추이를 그래프로 보여주자.
 *
 * // kafka-node 모듈을 이용하여 offset 및 logSize 구하기
 * var kafka = require('kafka-node'),
 *  client = new kafka.Client('112.175.29.45:10013/NHN/NELO2/kafka'),
 *  offset = new kafka.Offset(client);
 *
 *  // consumer가 가져간 Offset 구하기
 *  offset.fetchCommits('consumerGroupId', [
 *  	{ topic: 'topicName', partition: 0 }
 *  ], function (err, data) {
 *  });
 *
 *  // topic partition LogSize
 *  offset.fetch([
 *  	{ topic: 'topicName', partition: 0, time: -1, maxNum: 1 }
 *  ], function (err, data) {
 *  });
 */

var zkHosts = function() {
	var zkHosts = null;
	if(conf.zookeeper && conf.zookeeper.hosts) {
		var zk_hosts = conf.zookeeper.hosts.split(',');
		var rootPath = (conf.kafka && conf.kafka.rootPath) || '';
		var hosts = [];
		for(var i = 0; i < zk_hosts.length; i++) {
			hosts.push(zk_hosts[i]+rootPath);
		}
		zkHosts = hosts.toString();
	}
	return zkHosts;
}();

var zkClient;

var kafkaClient;
var kafkaOffset;

var socketClients = {
	socket: [],
	req: [],
	status: []
};

var NODE_PATH = {
	broker : '/brokers/ids',
	topic : '/brokers/topics',
	consumer : '/consumers'
};
var EXP_TIME = 1000 * 60 * 5;
var BROKER_CACHE = {
	expires: new Date().getTime() + EXP_TIME,
	brokers: null
};
var TOPIC_CACHE = {
	expires: new Date().getTime() + EXP_TIME,
	topics: null
};
var CONSUMER_CACHE = {
	expires: new Date().getTime() + EXP_TIME,
	consumers: null
};

function getKafkaClient() {
	if(!kafkaClient) {
		logger.debug('[kafka.getKfakaClient] zkHosts;', zkHosts);
		//var client = new kafka.Client('112.175.29.45:10013/NHN/NELO2/kafka');
		kafkaClient = new kafka.Client(zkHosts);
	}
	return kafkaClient;
}

function getKafkaOffset() {
	if(!kafkaOffset) {
		var kafkaClient = getKafkaClient();
		kafkaOffset = new kafka.Offset(kafkaClient);
	}
	return kafkaOffset;
}

function getZkClient() {
	if(!zkClient) {
		var sync = true;
		zkClient = new ZkClient(zkHosts);
		zkClient.zk.add_auth(conf.zookeeper.scheme, conf.zookeeper.auth, function(rc, err) {
			if (rc !== 0) {
				logger.error('[kafka.getZkClient] Zookeeper auth error; code:' + rc, err);
			}
			sync = false;
		});
		// convert async to sync
		while(sync) {
			require('deasync').runLoopOnce();
		}
	}
	return zkClient;
}

function checkConnections() {
	if(!zkClient) {
		logger.debug('[kafka.checkConnections] Init zookeeper client.');
		zkClient = new ZkClient(zkHosts);
	}
	if(!kafkaClient) {
		kafkaClient = new kafka.Client(zkHosts);
		kafkaOffset = new kafka.Offset(kafkaClient);
		logger.debug('[kafka.checkConnections] Init kafka client;', kafkaClient.zk);
	}
}

exports.index = function(req, res) {
	checkConnections();
	logger.debug('[kafka.index] Response kafka tool page');
	var title = res.__i('title');
	res.render('kafka', {
		layout: false,
		title: title
	});
};

/**
 * 화면 좌측 Tree
 *
 * @param req
 * @param res
 */
exports.getKafkaTrees = function(req, res) {
	logger.debug('[kafka.getKafkaTrees] Getting Tree Data...');
	async.parallel({
		brokers : function(cb) {
			getBrokers(function(err, brokers) {
				var result = [];
				if(!err) {
					brokers.forEach(function(broker) {
						result.push({
							id: 'broker:'+broker.id,
							text: [ broker.data.host, ':', broker.data.port ].join(''),
							children: false
						});
					});
					result = _.sortBy(result, 'text');
				}
				cb(err, result);
			});
		},
		topics : function(cb) {
			getTopics(function(err, topics) {
				var result = [];
				if(!err) {
					logger.debug('[kafka.getNodeList] Topic count:', topics.length);
					topics.forEach(function(topic) {
						result.push({
							id: 'topic:'+topic,
							text: topic,
							children: false
						});
					});
					result = _.sortBy(result, 'text');
				}
				cb(err, result);
			});
		},
		consumers : function(cb) {
			getConsumers(function(err, consumers) {
				var result = [];
				if(!err) {
					logger.debug('[kafka.getNodeList] Consumer count:', consumers.length);
					consumers.forEach(function(consumer) {
						result.push({
							id: 'consumer:'+consumer,
							text: consumer,
							children: false
						});
					});
					result = _.sortBy(result, 'text');
				}
				cb(err, result);
			});
		}
	}, function(err, results) {
		if(err) {
			logger.error('[kafka.getKafkaTrees] Process error; ', err);
		}
		var list = [
			{ id: 'broker', text: 'Brokers', children: results.brokers },
			{ id: 'topic', text: 'Topics', children: results.topics },
			{ id: 'consumer', text: 'Consumers', children: results.consumers }
		];
		res.json(list);
	});
};

/**
 * 좌측 Tree에서 선택한 node에 따라 표시될 우측 정보 영역에 출력할 내용
 *
 * @param req
 * @param res
 */
exports.getContent = function(req, res) {
	var node = req.query.node;
	var tmp = node.split(':');
	var type = tmp[0];
	var name = tmp.length > 1 ? tmp[1] : null;
	var kafkaClient = getKafkaClient();

	if(type === 'broker') {
		if(name) {
			logger.debug('[kafka.getContent] Broker;', name);
			BrokerInfo(name, function(err, resp) {
				res.json({ status: 200, type: type, name: name, data: resp });
			});
		} else {
			getBrokerList(function(err, brokers) {
				res.json({ status: 200, type: type, name: name, data: brokers });
			});
		}
	} else if(type === 'topic') {
		if(name) {
			logger.debug('[kafka.getContent] Topic;', name);
			getTopicConsumerList(name, function(err, list) {
				res.json({ status: 200, type: type, name: name, data: list });
			});
		} else {
			async.waterfall([
				function(cb) {
					getTopics(cb);
				},
				function(topics, cb) {
					getTopicList(topics, cb);
				}
			], function(err, resp) {
				if(err) {
					logger.error('[kafka.getContent] Topic list fetch error; ', err);
				}
				res.json({ status: 200, type: type, name: name, data: resp });
			});
		}
	} else if(type === 'consumer') {
		if(name) {
			logger.debug('[kafka.getContent] Consumer;', name);
			getConsumerTopicList(name, function(err, list) {
				res.json({ status: 200, type: type, name: name, data: list });
			})
		} else {
			async.waterfall([
				function(cb) {
					getConsumers(cb);
				},
				function(consumers, cb) {
					getConsumerList(consumers, cb);
				}
			], function(err, resp) {
				if(err) {
					logger.error('[kafka.getContent] Consumer list fetch error; ', err);
				}
				res.json({ status: 200, type: type, name: name, data: resp });
			});
		}
	} else {
		logger.warn('[kafka.getContent] Invalid type;', type);
		res.json({ status: 200, type: type, name: name, data: {} });
	}
};

exports.showChart = function(req, res) {
	checkConnections();
	logger.debug('[kafka.showChart] Response kafka chart page');
	var title = res.__i('title');
	var interval = req.query.interval || (conf.kafka && conf.kafka.check_interval) || 5000;
	if(interval < 1000) interval = 1000;
	res.render('kafka_chart', {
		layout: false,
		title: title,
		socketServer: 'http://'+conf.host + ':' + conf.port,
		topic: req.params.topic,
		consumer: req.params.consumer,
		interval: interval
	});
};

exports.requestChart = function(socket, req) {
	logger.debug('[kafka.responseChart] Start chart service;', req);
	var idx = getSoIndex(socket);
	if(idx === -1) {
		socketClients.socket.push(socket);
		socketClients.req.push(req);
		var now = new Date().getTime();
		socketClients.status.push({
			init_time: now,
			init_logSize: 0,
			init_offset: 0
		});
		responseChart(socket, req, checckResponse);
	} else {
		socketClients.req[idx] = req;
	}
};

exports.stopChart = function(socket) {
	var idx = getSoIndex(socket);
	if(idx != -1) {
		logger.info('[kafka.stopChart] Stopping socket.io service; ', socket.id);
		delete socketClients.socket[idx];
		delete socketClients.req[idx];
		delete socketClients.status[idx];
	}
};

function getSoIndex(socket) {
	return socketClients.socket.indexOf(socket);
}

function getStatus(idx) {
	return (idx < socketClients.status.length) ? socketClients.status[idx] : null;
}

function checckResponse(socket, req) {
	var idx = getSoIndex(socket);
	if(idx != -1) {
		req = socketClients.req[idx];
		var tm = req.interval || conf.kafka.check_interval || 5000;
		setTimeout(function() {
			responseChart(socket, req, checckResponse);
		}, tm);
	}
}

function responseChart(socket, req, cb) {
	var topic = req.topic;
	var consumer = req.consumer;
	logger.debug('[kafka.responseChart] Getting chart data;', { topic:topic, consumer:consumer });
	async.waterfall([
		function(cb) {
			var kafkaClient = getKafkaClient();
			kafkaClient.loadMetadataForTopics([ topic ], cb);
		},
		function(data, cb) {
			//logger.debug('[kafka.responseChart] loadMetadataForTopics;', data);
			// t_info = { topic: topic, logSize: 0, offset: 0, lag: 0, partitions: [ { partition: 0, logSize: 0, lag: 0, leader: 0, borker: ''... } ] };
			var t_info = { topic: topic, logSize: 0, offset: 0, partitions: [] };
			if(data && data.length > 1) {
				var metadata = data[1].metadata;
				//logger.debug('[kafka.responseChart] metadata;', metadata);
				var part = metadata[topic];
				//logger.debug('[kafka.responseChart] metadata['+topic+'];', part);
				Object.keys(part).forEach(function(idx) {
					//logger.debug('[kafka.responseChart] partition['+idx+'];', part[idx]);
					part[idx].logSize = 0;
					t_info.partitions.push(part[idx]);
				});
				// Set log size
				setLogSize(t_info, cb);
			} else {
				cb(null, t_info);
			}
		},
		function(t_info, cb) {
			// t_info = { topic: topic, logSize: 0, offset: 0, lag: 0, partitions: [ { partition: 0, offset:0, logSize: 0, lag: 0, owner: '', ctime: '', mtime: '' } ] };
			//logger.debug('[kafka.responseChart] t_info:', JSON.stringify(t_info));
			var zkclient = getZkClient();
			async.each(t_info.partitions, function(part, cbb) {
				//logger.debug('[kafka.responseChart] part:', JSON.stringify(part));
				var path = '/consumers/'+consumer+'/offsets/'+part.topic+'/'+part.partition;
				zkclient.zk.a_get(path, null, function(rc, err, stat, data) {
					if(rc === 0) {

						var offset = getOffset(data);
						var lag = part.logSize - offset;

						part.offset = offset;
						part.lag = lag;

						// Offset
						if(!t_info.offset) t_info.offset = 0;
						t_info.offset += offset;

						// Lag
						if(!t_info.lag) t_info.lag = 0;
						t_info.lag += lag;

						cbb();
					} else {
						logger.error('[kafka.responseChart] zkclient.zk.a_get() error; ', err);
						cbb(err);
					}
				});
			}, function(err) {
				cb(err, t_info);
			});
		}
	], function(err, t_info) {
		if(err) {
			logger.error('[kafka.responseChart] Process error; ', err);
		}

		var idx = getSoIndex(socket);
		if(idx != -1 && t_info) {
			var now = new Date().getTime();
			var logSize = t_info.logSize || 0;
			var offset = t_info.offset || 0;
			var lag = t_info.lag || 0;

			var inc_logSize = 0, inc_offset = 0, proc_tm = 0;
			var status = getStatus(idx);
			if(status) {
				proc_tm = now - status.init_time;
				if(status.init_logSize) {
					inc_logSize = logSize - status.init_logSize;
				} else {
					status.init_logSize = logSize;
				}
				if(status.init_offset) {
					inc_offset = offset - status.init_offset;
				} else {
					status.init_offset = offset;
				}
			}

			var chartRes = {
				xAxis: now,
				yAxis: {
					logSize: logSize,
					offset: offset,
					lag: lag,
					proc_time: proc_tm,
					inc_logSize: inc_logSize,
					inc_offset: inc_offset
				}
			};
			logger.debug('[kafka.responseChart] Response chart data;', chartRes);
			socket.emit('kafkachart', chartRes);
		} else if(idx === -1) {
			logger.debug('[kafka.responseChart] Socket closed;', socket.id);
		} else {
			logger.debug('[kafka.responseChart] Invalid chart data; no data.');
		}
		cb(socket, req);
	});
}

function getOffset(data) {
	try {
		var dataStr = data ? data.toString() : '0';
		var off = dataStr.lastIndexOf('}');
		if(off != -1) dataStr = dataStr.substring(0, off+1);
		var obj = JSON.parse(dataStr);
		return (obj.offset != undefined) ? obj.offset : obj;
	} catch(err) {
		logger.error('[kafka.getOffset] data parsing error;', err);
		return 0;
	}
}

function parseJsonData(data) {
	try {
		var dataStr = data ? data.toString() : '{}';
		var off = dataStr.lastIndexOf('}');
		if(off != -1) dataStr = dataStr.substring(0, off+1);
		return JSON.parse(dataStr);
	} catch(err) {
		logger.error('[kafka.parseJsonData] data parsing error; ', err);
		return {};
	}
}

var BrokerInfo = function(id, cb) {
	var zkclient = getZkClient();
	zkclient.zk.a_get(NODE_PATH.broker+'/'+id, null, function(rc, err, stat, data) {
		var bInfo = parseJsonData(data);
		if(rc === 0) {
			//logger.debug('[kafka.BrokerInfo] Broker Info;', bInfo);
			cb(null, { id: id, stat: stat, data: bInfo });
		} else {
			logger.error('[kafka.BrokerInfo] Borker info getting error; code:'+rc, err);
			cb(err, { id: id, stat: stat, data: bInfo });
		}
	});
};

function getBrokers(cb) {
	var now = new Date().getTime();
	if(!BROKER_CACHE.brokers || BROKER_CACHE.expires < now) {
		var zkclient = getZkClient();
		zkclient.zk.a_get_children(NODE_PATH.broker, null, function(rc, err, ids) {
			BROKER_CACHE.expires = now + EXP_TIME;
			if(rc === 0) {
				logger.debug('[kafka.getBrokers] Broker count:', ids.length);
				async.map(ids, BrokerInfo, cb);
			} else {
				logger.error('[kafka.getBrokers] Broker list find error; code:' + rc, err);
				cb(err);
			}
		});
	} else {
		cb(null, BROKER_CACHE.brokers);
	}
}

function getTopics(cb) {
	var now = new Date().getTime();
	if(!TOPIC_CACHE.topics || TOPIC_CACHE.expires < now) {
		getNodeList(NODE_PATH.topic, function(err, topics) {
			TOPIC_CACHE.expires = now + EXP_TIME;
			cb(err, topics);
		});
	} else {
		cb(null, TOPIC_CACHE.topics);
	}
}

function getConsumers(cb) {
	var now = new Date().getTime();
	if(!CONSUMER_CACHE.consumers || CONSUMER_CACHE.expires < now) {
		getNodeList(NODE_PATH.consumer, function(err, topics) {
			CONSUMER_CACHE.expires = now + EXP_TIME;
			cb(err, topics);
		});
	} else {
		cb(null, CONSUMER_CACHE.consumers);
	}
}

function getNodeList(path, cb) {
	var zkclient = getZkClient();
	zkclient.zk.a_get_children(path, null, function(rc, err, nodes) {
		if(rc === 0) {
			cb(null, nodes.sort());
		} else {
			logger.error('[kafka.getNodeList] Node list find error; code:' + rc + ', path: ' + path + ', err:', err);
			cb(err);
		}
	});
}

/**
 * Broker(Kafka Server) 목록
 *
 * @param cb
 */
function getBrokerList(cb) {
	logger.debug('[kafka.getBrokerList] Getting broker list...');
	var brokers;
	var topics;
	async.waterfall([
		function(cb) {
			async.parallel({
				brokers: function(cb) {
					getBrokers(cb);
				},
				topics: function(cb) {
					getTopics(cb);
				}
			}, function(err, results) {
				if(!err) {
					brokers = results.brokers;
					for(var i = 0; i < brokers.length; i++) {
						brokers[i].topicCount = 0;
					}
					topics = results.topics;
				}
				cb(err);
			});
		},
		function(cb) {
			var kafkaClient = getKafkaClient();
			kafkaClient.loadMetadataForTopics(topics, cb);
		},
		function(data, cb) {
			if(data && data.length > 1) {
				logger.debug('[kafka.getBrokerList] loadMetadataForTopics method called');
				var metadata = data[1].metadata;
				//logger.debug('[kafka.getBrokerList] metadata;', metadata);
				var part, topic, bid, found = false;
				for(var x in topics) {
					topic = topics[x];
					part = metadata[topic];
					//logger.debug('[kafka.getBrokerList] metadata['+topic+'];', part);
					found = false;
					Object.keys(part).forEach(function(idx) {
						//logger.debug('[kafka.getBrokerList] partition['+idx+'];', part[idx]);
						bid = part[idx].leader;
						if(brokers[bid]) {
							if(!found) {
								found = true;
								brokers[bid].topicCount++;
								return;
							}
						} else {
							logger.info('[kafka.getBrokerList] Broker not found for '+bid);
						}
					});
				}
				cb();
			} else {
				cb('Invalid topics metadata');
			}
		}
	], function(err) {
		if(err) {
			logger.error('[kafka.getBrokerList] Process error; ', err);
		} else if(brokers) {
			logger.debug('[kafka.getBrokerList] Broker list size;', brokers.length);
		}
		cb(err, brokers);
	});
}

/**
 * Topic 목록 정보
 *
 * @param topics
 * @param cb
 */
function getTopicList(topics, cb) {
	/* data struct
	 [
	 {
	 '0': { nodeId: 0, host: '112.175.29.39', port: 9092 }
	 },
	 {
	 metadata: {
	 'notifier-topic2':  {
	 '0': { topic: 'notifier-topic2', partition: 0, leader: 0, replicas: [Object], isr: [Object] },
	 '1': { topic: 'notifier-topic2', partition: 1, leader: 0, replicas: [Object], isr: [Object] }
	 },
	 'notifier-topic3': [Object],
	 'notifier-topic': [Object]
	 }
	 }
	 ]
	 */
	logger.debug('[kafka.getTopicList] Getting Topic list...');
	var kafkaClient = getKafkaClient();
	kafkaClient.loadMetadataForTopics(topics, function(err, data) {
		logger.debug('[kafka.getTopicList] loadMetadataForTopics method called');
		var list = [];
		if(data && data.length > 1) {
			var metadata = data[1].metadata;
			//logger.debug('[kafka.getTopicList] metadata;', metadata);

			var part, topic;
			for(var x in topics) {
				topic = topics[x];
				part = metadata[topic];
				if(!part) continue;

				// t_info = { topic: topic, partitions: [{ partition: 0, logSize: 0, leader: 0, borker: '', ... }], logSize: 0 }
				var t_info = { topic: topic, partitions: [], logSize: 0 };
				//logger.debug('[kafka.getTopicList] metadata['+topic+'];', part);
				Object.keys(part).forEach(function(idx) {
					//logger.debug('[kafka.getTopicList] partition['+idx+'];', part[idx]);
					var broker = data[0][part[idx].leader];
					//logger.debug('[kafka.getTopicList] broker;', broker);
					part[idx].broker = broker.host + ':' + broker.port;
					part[idx].logSize = 0;
					t_info.partitions.push(part[idx]);
				});
				list.push(t_info);
			}

			async.map(list, setLogSize, function(err, resp) {
				if(err) {
					logger.error('[kafka.getTopicList] Log size fetch result error;', err);
				} else {
					//logger.debug('[kafka.getTopicList] Fetched log size data;', resp);
				}
				logger.debug('[kafka.getTopicList] Topic list size;', list.length);
				cb(err, list);
			});
		} else {
			logger.warn('[kafka.getTopicList] topic metadata not found');
			cb(null, list);
		}
	});
}

/**
 * Consumer List
 *
 * @param consumers
 * @param cb
 */
function getConsumerList(consumers, cb) {
	logger.debug('[kafka.getConsumerList] Getting Consumer list...');
	var list = []; // [ { consumer: '', topics: [ { topic: '', offset: 0, partitions: [ partition: 0, offset: 0 ] } ] } ]
	async.each(consumers, function(consumer, cbb) {
		var path = '/consumers/'+consumer+'/offsets';
		getNodeList(path, function(err, topics) {
			if(!err) {
				setTopicOffset(consumer, topics, function(err, c_info) {
					list.push(c_info);
					cbb(err);
				});
			} else {
				logger.error('[kafka.getConsumerList] getNodeList error. path:'+path+', err:', err);
				list.push({ consumer: consumer, topics: [] });
				cbb();
			}
		});
	}, function(err) {
		if(err) {
			logger.error('[kafka.getConsumerList] Process error; ', err);
		}
		logger.debug('[kafka.getConsumerList] Consumer list size;', list.length);
		cb(err, _.sortBy(list, 'consumer'));
	});
}

function setTopicOffset(consumer, topics, cb) {
	var path = '/consumers/'+consumer+'/offsets';
	var c_info = { consumer: consumer, topics: [] };
	async.each(topics, function(topic, cbb) {
		var t_path = path+'/'+topic;
		getNodeList(t_path, function(err, parts) {
			if(!err) {
				setPartitionOffset(t_path, topic, parts, function(err, t_info) {
					c_info.topics.push(t_info);
					cbb(err);
				});
			} else {
				logger.error('[kafka.setTopicOffset] getNodeList error. path:'+t_path+', err:', err);
				cbb();
			}
		});
	}, function(err) {
		if(err) {
			logger.error('[kafka.setTopicOffset] async.each process error. path:'+path, err);
		}
		cb(err, c_info);
	});
}

function setPartitionOffset(t_path, topic, parts, cb) {
	var t_info = { topic: topic, offset: 0, partitions: [] };
	async.each(parts, function(part, cbb) {
		var p_path = t_path + '/' + part;
		var zkclient = getZkClient();
		zkclient.zk.a_get(p_path, null, function (rc, err, stat, data) {
			if(rc === 0) {
				var offset = getOffset(data);
				//if(consumer === 'river') logger.debug('===> offset;', offset);
				var p_info = { partition: part, offset: offset };
				if(stat) {
					p_info.ctime = stat.ctime;
					p_info.mtime = stat.mtime;
				}
				t_info.partitions.push(p_info);
				t_info.offset += offset;
				cbb();
			} else {
				logger.error('[kafka.setPartitionOffset] zkclient.zk.a_get error. path:'+p_path+', err:', err);
				cbb(err);
			}
		});
	}, function(err) {
		if(err) {
			logger.error('[kafka.setPartitionOffset] async.each process error. path:'+t_path, err);
		}
		cb(err, t_info);
	});
}

/**
 * 주어진 Topic을 참조하고 있는 Consumer 목록 정보
 *
 * @param topic
 * @param cb
 */
function getTopicConsumerList(topic, cb) {
	logger.debug('[kafka.getTopicConsumerList] Getting topic consumer list...');
	var tlist = [];
	async.waterfall([
		function(cb) {
			getConsumers(cb);
		},
		function(consumers, cb) {
			async.each(consumers, function(consumer, cbb) {
				// list = [ { topic: topic, offset: 0 logSize: 0, lag: 0, partitions: [ { partition: 0, offset:0, logSize: 0, lag: 0, owner: '', ctime: '', mtime: '' } ] } ];
				getConsumerTopicList(consumer, function(err, list) {
					if(err) {
						logger.error('[kafka.getTopicConsumerList] getConsumerTopicList error;', err);
					} else if(list && list.length) {
						logger.debug('[kafka.getTopicConsumerList] getConsumerTopicList length;', list.length);
						for(var i = 0; i < list.length; i++) {
							if(topic === list[i].topic) {
								//logger.debug('[kafka.getTopicConsumerList] getConsumerTopicList['+i+'];', list[i]);
								var info = list[i];
								info.consumer = consumer;
								delete info.topic;
								tlist.push(info);
							}
						}
					}
					cbb();
				});
			}, cb);
		}
	], function(err) {
		if(err) {
			logger.error('[kafka.getTopicConsumerList] Process error; ', err);
		}
		logger.debug('[kafka.getTopicConsumerList] topic consumer list size;', tlist.length);
		cb(null, tlist);
	});
};

/**
 * 주어진 Consumer가 참조하고 있는 Topic 목록 정보
 *
 * @param consumer
 * @param cb
 */
function getConsumerTopicList(consumer, cb) {
	logger.debug('[kafka.getConsumerTopicList] Getting consumer topic list...');
	var path = '/consumers/'+consumer+'/offsets';
	//logger.debug('[kafka.getConsumerTopicList] path:', path);
	async.waterfall([
		function(cb) {
			getNodeList(path, cb);
		},
		function(topics, cb) {
			//logger.debug('[kafka.getConsumerTopicList] topics:', topics);
			getTopicList(topics, cb);
		},
		function(list, cb) {
			//logger.debug('[kafka.getConsumerTopicList] list:', JSON.stringify(list));
			// list = [ { topic: topic, logSize: 0, partitions: [ { partition: 0, logSize: 0, lag: 0, leader: 0, borker: ''... } ] } ];
			// new list = [ { topic: topic, offset: 0 logSize: 0, lag: 0, partitions: [ { partition: 0, offset:0, logSize: 0, lag: 0, owner: '', ctime: '', mtime: '' } ] } ];
			async.each(list, function(t_info, cbb) {
				//logger.debug('[kafka.getConsumerTopicList] t_info:', JSON.stringify(t_info));
				async.each(t_info.partitions, function(part, cbbb) {
					getTopicPartitionInfo(consumer, t_info, part, cbbb);
				}, cbb);
			}, function(err) {
				cb(err, list);
			});
		}
	], function(err, list) {
		if(err) {
			logger.error('[kafka.getConsumerTopicList] Process error; ', err);
		} else {
			logger.debug('[kafka.getConsumerTopicList] consumer topic list size; ', list.length);
		}
		cb(err, list);
	});
}

function getTopicPartitionInfo(consumer, t_info, part, cb) {
	//logger.debug('[kafka.getTopicPartitionInfo] topic:', part.topic);
	var zkclient = getZkClient();
	async.parallel({
		offset: function(cb) {
			zkclient.zk.a_get('/consumers/'+consumer+'/offsets/'+part.topic+'/'+part.partition, null, function(rc, err, stat, data) {
				if(rc === 0) {
					if(stat) {
						part.ctime = stat.ctime;
						part.mtime = stat.mtime;
					}

					var offset = getOffset(data);
					var lag = part.logSize - offset;

					part.offset = offset;
					part.lag = lag;

					if(!t_info.offset) t_info.offset = 0;
					t_info.offset += offset;

					if(!t_info.lag) t_info.lag = 0;
					t_info.lag += lag;

					cb();
				} else {
					logger.error('[kafka.getTopicPartitionInfo] Offset info zkclient.zk.a_get() error; ', err);
					cb(err);
				}
			});
		},
		owner: function(cb) {
			zkclient.zk.a_get('/consumers/'+consumer+'/owners/'+part.topic+'/'+part.partition, null, function(rc, err, stat, data) {
				if(rc === 0) {
					part.owner = data ? data.toString() : '';
				} else {
					//logger.debug('[kafka.getTopicPartitionInfo] Owner info zkclient.zk.a_get() error; ', err);
				}
				cb();
			});
		}
	}, function(err, results) {
		if(err) {
			logger.error('[kafka.getTopicPartitionInfo] Process error; ', err);
		}
		cb(err);
	});
}

function setLogSize(tinfo, cb) {
	var topic = tinfo.topic;
	var list = [];
	for(var i = 0; i < tinfo.partitions.length; i++) {
		list.push({ topic: topic, partition: tinfo.partitions[i].partition, time: -1 });
	}
	var totalSize = 0;
	// { 'notifier-topic': { '0': [ 400000 ], '2': [ 400000 ] } }
	var kafkaOffset = getKafkaOffset();
	kafkaOffset.fetch(list, function(err, resp1) {
		if(err) {
			logger.error('[kafka.setLogSize] Offset fetch error; ', err);
			cb(err);
		} else {
			//logger.debug('[kafka.setLogSize] Offset fetch data; ', resp1);
			Object.keys(resp1[topic]).forEach(function(idx) {
				tinfo.partitions[idx].logSize = resp1[topic][idx][0];
				totalSize += tinfo.partitions[idx].logSize;
			});
			tinfo.logSize = totalSize;
			cb(null, tinfo);
		}
	});
}