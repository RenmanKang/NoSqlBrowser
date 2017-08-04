var routes = [
	{
		url: '/',
		path: './routes/index',
		fn: 'index',
		method: 'get'
	},
	{
		url: '/mongodb',
		path: './routes/index',
		fn: 'mongodb',
		method: 'get'
	},
	{
		url: '/redis',
		path: './routes/index',
		fn: 'redis',
		method: 'get'
	},
	{
		url: '/elasticsearch',
		path: './routes/index',
		fn: 'elasticsearch',
		method: 'get'
	},
	{
		url: '/zookeeper',
		path: './routes/index',
		fn: 'zookeeper',
		method: 'get'
	},
	{
		url: '/kafka',
		path: './routes/index',
		fn: 'kafka',
		method: 'get'
	},
	{
		url: '/cubrid',
		path: './routes/index',
		fn: 'cubrid',
		method: 'get'
	},
	{
		url: '/api/cubrid/tree',
		path: './routes/cubrid',
		fn: 'getTableTrees',
		method: 'get'
	},
	{
		url: '/api/cubrid/get',
		path: './routes/cubrid',
		fn: 'getTableInfo',
		method: 'get'
	},
	{
		url: '/api/cubrid/query',
		path: './routes/cubrid',
		fn: 'getQueryResults',
		method: 'post'
	},
	{
		url: '/api/cubrid/query/history',
		path: './routes/cubrid',
		fn: 'getQueryHistory',
		method: 'get'
	},
	{
		url: '/api/cubrid/query/history',
		path: './routes/cubrid',
		fn: 'addQueryHistory',
		method: 'post'
	},
	{
		url: '/api/cubrid/query/history/:index',
		path: './routes/cubrid',
		fn: 'removeQueryHistory',
		method: 'delete'
	},
	{
		url: '/api/mongodb/tree',
		path: './routes/mongodb',
		fn: 'getDbTrees',
		method: 'get'
	},
	{
		url: '/api/mongodb/stats/:database',
		path: './routes/mongodb',
		fn: 'getDatabaseStats',
		method: 'get'
	},
	{
		url: '/api/mongodb/stats/:database/:collection',
		path: './routes/mongodb',
		fn: 'getCollectionStats',
		method: 'get'
	},
	{
		url: '/api/mongodb/:database/:collection',
		path: './routes/mongodb',
		fn: 'listDocument',
		method: 'get'
	},
	{
		url: '/api/mongodb/:database/:collection',
		path: './routes/mongodb',
		fn: 'searchDocument',
		method: 'post'
	},
	{
		url: '/mongodb/status',
		path: './routes/mongodb',
		fn: 'viewServerStatus',
		method: 'get'
	},
	{
		url: '/mongodb/db/:database/:collection/add',
		path: './routes/mongodb',
		fn: 'addDocument',
		method: 'post'
	},
	{
		url: '/mongodb/db/:database/:collection/:document',
		path: './routes/mongodb',
		fn: 'viewDocument',
		method: 'get'
	},
	{
		url: '/mongodb/db/:database/:collection/:document',
		path: './routes/mongodb',
		fn: 'updateDocument',
		method: 'put'
	},
	{
		url: '/mongodb/db/:database/:collection/_all',
		path: './routes/mongodb',
		fn: 'deleteAllDocuments',
		method: 'delete'
	},
	{
		url: '/mongodb/db/:database/:collection/:document',
		path: './routes/mongodb',
		fn: 'deleteDocument',
		method: 'delete'
	},
	{
		url: '/mongodb/db/:database/:collection',
		path: './routes/mongodb',
		fn: 'viewCollection',
		method: 'get'
	},
	{
		url: '/mongodb/db/:database/:collection',
		path: './routes/mongodb',
		fn: 'addCollection',
		method: 'post'
	},
	{
		url: '/mongodb/db/:database/:collection',
		path: './routes/mongodb',
		fn: 'renameCollection',
		method: 'put'
	},
	{
		url: '/mongodb/db/:database/:collection',
		path: './routes/mongodb',
		fn: 'deleteCollection',
		method: 'delete'
	},
	{
		url: '/mongodb/db/:database',
		path: './routes/mongodb',
		fn: 'viewDatabase',
		method: 'get'
	},
	{
		url: '/mongodb/db/:database',
		path: './routes/mongodb',
		fn: 'addDatabase',
		method: 'post'
	},
	{
		url: '/mongodb/db/:database',
		path: './routes/mongodb',
		fn: 'renameDatabase',
		method: 'put'
	},
	{
		url: '/mongodb/db/:database',
		path: './routes/mongodb',
		fn: 'deleteDatabase',
		method: 'delete'
	},
	{
		url: '/redis/login',
		path: './routes/redis/index',
		fn: 'postLogin',
		method: 'post'
	},
	{
		url: '/redis/logout/:connectionId',
		path: './routes/redis/index',
		fn: 'postLogout',
		method: 'post'
	},
	{
		url: '/redis/config',
		path: './routes/redis/index',
		fn: 'getConfig',
		method: 'get'
	},
	{
		url: '/redis/config',
		path: './routes/redis/index',
		fn: 'postConfig',
		method: 'post'
	},
	{
		url: '/redis/tools/export',
		path: './routes/redis/tools',
		fn: 'redisExport',
		method: 'get'
	},
	{
		url: '/redis/tools/import',
		path: './routes/redis/tools',
		fn: 'redisImport',
		method: 'post'
	},
	{
		url: '/redis/apiv1/server/info',
		path: './routes/redis/apiv1',
		fn: 'getServersInfo',
		method: 'get'
	},
	{
		url: '/redis/apiv1/key/:connectionId/:key/:index?',
		path: './routes/redis/apiv1',
		fn: 'getKeyDetails',
		method: 'get'
	},
	{
		url: '/redis/apiv1/key/:connectionId/:key',
		path: './routes/redis/apiv1',
		fn: 'postKey',
		method: 'post'
	},
	{
		url: '/redis/apiv1/keys/:connectionId/:key',
		path: './routes/redis/apiv1',
		fn: 'postKeys',
		method: 'post'
	},
	{
		url: '/redis/apiv1/listvalue/',
		path: './routes/redis/apiv1',
		fn: 'postAddListValue',
		method: 'post'
	},
	{
		url: '/redis/apiv1/editListRow',
		path: './routes/redis/apiv1',
		fn: 'postEditListRow',
		method: 'post'
	},
	{
		url: '/redis/apiv1/editZSetRow',
		path: './routes/redis/apiv1',
		fn: 'postEditZSetRow',
		method: 'post'
	},
	{
		url: '/redis/apiv1/editHashRow',
		path: './routes/redis/apiv1',
		fn: 'postEditHashRow',
		method: 'post'
	},
	{
		url: '/redis/apiv1/keystree/:connectionId/:keyPrefix',
		path: './routes/redis/apiv1',
		fn: 'getKeysTree',
		method: 'get'
	},
	{
		url: '/redis/apiv1/keystree/:connectionId',
		path: './routes/redis/apiv1',
		fn: 'getKeysTree',
		method: 'get'
	},
	{
		url: '/redis/apiv1/keys/:connectionId/:keyPrefix',
		path: './routes/redis/apiv1',
		fn: 'getKeys',
		method: 'get'
	},
	{
		url: '/redis/apiv1/exec',
		path: './routes/redis/apiv1',
		fn: 'postExec',
		method: 'post'
	},
	{
		url: '/redis/apiv1/connection',
		path: './routes/redis/apiv1',
		fn: 'isConnected',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/cluster/health',
		path: './routes/elasticsearch',
		fn: 'getClusterHealth',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/cluster/stats',
		path: './routes/elasticsearch',
		fn: 'getClusterStats',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/cluster/state',
		path: './routes/elasticsearch',
		fn: 'getClusterState',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/tree',
		path: './routes/elasticsearch',
		fn: 'getEsTree',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/search/:indices',
		path: './routes/elasticsearch',
		fn: 'listDocument',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/search/:indices',
		path: './routes/elasticsearch',
		fn: 'searchDocument',
		method: 'post'
	},
	{
		url: '/api/elasticsearch/search/:indices/:types',
		path: './routes/elasticsearch',
		fn: 'listDocument',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/search/:indices/:types',
		path: './routes/elasticsearch',
		fn: 'searchDocument',
		method: 'post'
	},
	{
		url: '/api/elasticsearch/indices/:index',
		path: './routes/elasticsearch',
		fn: 'createIndex',
		method: 'post'
	},
	{
		url: '/api/elasticsearch/indices/:index',
		path: './routes/elasticsearch',
		fn: 'deleteIndex',
		method: 'delete'
	},
	{
		url: '/api/elasticsearch/indices/docs/:index',
		path: './routes/elasticsearch',
		fn: 'addDocument',
		method: 'post'
	},
	{
		url: '/api/elasticsearch/indices/status/:indices',
		path: './routes/elasticsearch',
		fn: 'getIndexStatus',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/indices/stats/:indices',
		path: './routes/elasticsearch',
		fn: 'getIndexStats',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/templates',
		path: './routes/elasticsearch',
		fn: 'getTemplate',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/templates/:template',
		path: './routes/elasticsearch',
		fn: 'getTemplate',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/templates/:template',
		path: './routes/elasticsearch',
		fn: 'putTemplate',
		method: 'put'
	},
	{
		url: '/api/elasticsearch/templates/:template',
		path: './routes/elasticsearch',
		fn: 'deleteTemplate',
		method: 'delete'
	},
	{
		url: '/api/elasticsearch/indices/mapping/:indices',
		path: './routes/elasticsearch',
		fn: 'getIndexMapping',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/indices/mapping/:indices',
		path: './routes/elasticsearch',
		fn: 'putIndexMapping',
		method: 'put'
	},
	{
		url: '/api/elasticsearch/indices/mapping/:indices',
		path: './routes/elasticsearch',
		fn: 'deleteIndexMapping',
		method: 'delete'
	},
	{
		url: '/api/elasticsearch/indices/alias/:indices',
		path: './routes/elasticsearch',
		fn: 'getIndexAlias',
		method: 'get'
	},
	{
		url: '/api/elasticsearch/indices/alias/:indices',
		path: './routes/elasticsearch',
		fn: 'putIndexAlias',
		method: 'put'
	},
	{
		url: '/api/elasticsearch/indices/alias/:indices',
		path: './routes/elasticsearch',
		fn: 'deleteIndexAlias',
		method: 'delete'
	},
	{
		url: '/api/zookeeper/login',
		path: './routes/zookeeper',
		fn: 'login',
		method: 'post'
	},
	{
		url: '/api/zookeeper/tree',
		path: './routes/zookeeper',
		fn: 'getPathTrees',
		method: 'get'
	},
	{
		url: '/api/zookeeper/get',
		path: './routes/zookeeper',
		fn: 'getPathInfo',
		method: 'get'
	},
	{
		url: '/api/zookeeper/create',
		path: './routes/zookeeper',
		fn: 'createPath',
		method: 'post'
	},
	{
		url: '/api/zookeeper/edit',
		path: './routes/zookeeper',
		fn: 'editPath',
		method: 'post'
	},
	{
		url: '/api/zookeeper/delete',
		path: './routes/zookeeper',
		fn: 'deletePath',
		method: 'post'
	},
	{
		url: '/kafka/chart/:topic/:consumer',
		path: './routes/kafka',
		fn: 'showChart',
		method: 'get'
	},
	{
		url: '/api/kafka/tree',
		path: './routes/kafka',
		fn: 'getKafkaTrees',
		method: 'get'
	},
	{
		url: '/api/kafka/content',
		path: './routes/kafka',
		fn: 'getContent',
		method: 'get'
	}
];

module.exports = routes;
