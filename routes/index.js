exports.index = function(req, res) {
	require('./mongodb').index(req, res);
};
exports.mongodb = function(req, res) {
	require('./mongodb').index(req, res);
};
exports.redis = function(req, res) {
	require('./redis/index').index(req, res);
};
exports.elasticsearch = function(req, res) {
	require('./elasticsearch').index(req, res);
};
exports.zookeeper = function(req, res) {
	require('./zookeeper').index(req, res);
};
exports.kafka = function(req, res) {
	require('./kafka').index(req, res);
};
exports.cubrid = function(req, res) {
	require('./cubrid').index(req, res);
};
