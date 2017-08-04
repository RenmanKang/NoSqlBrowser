module.exports = {
	"host": "localhost",
	"port": 5056,
	"locales": [
		"en",
		"ko"
	],
	"session": {
		"maxAge": 86400000
	},
	"logger": {
		"access": {
			"category": "access",
			"type": "dateFile",
			"filename": __dirname+"/../logs/access.log",
			"pattern": "-yyyy-MM-dd",
			"alwaysIncludePattern": false,
			"level": "DEBUG"
		},
		"app": {
			"category": "app",
			"type": "dateFile",
			"filename": __dirname+"/../logs/app.log",
			"pattern": "-yyyy-MM-dd",
			"alwaysIncludePattern": false,
			"level": "DEBUG"
		}
	},
	"backup" : {
		"path": __dirname+"/"
	},
	"mongodb": {
		"host": "localhost",
		"port": 27017,
		"user": "",
		"password": "",
		"min_connection": 3,
		"max_connection": 10
	},
	"redis": {
		"host": "localhost",
		"port": 6379,
		"idleTimeoutMillis": 30000,
		"refreshIdle": false,
		"maxConnection": 5,
		"ttl": 3600000
	},
	"elasticsearch": {
		"host": "localhost",
		"port": 9200,
		"user": "admin",
		"password": "admin",
		"apiVersion": "1.7",
		"indexGroup": [
			{
				"prefix": "daily-log-",
				"name": "daily-log"
			},
			{
				"prefix": "weekly-log-",
				"name": "weekly-log"
			},
			{
				"prefix": "logstash-log-",
				"name": "logstash-log"
			},
			{
				"prefix": ".marvel-",
				"name": "marvel"
			}
		]
	},
	"zookeeper": {
		"hosts": "localhost:2181",
		"scheme": "digest",
		"auth": "admin:admin"
	},
	"kafka": {
		"rootPath": "/kafka"
	},
	"cubrid": {
		"host": "localhost",
		"port": 1523,
		"user": "cubrid",
		"password": "cubrid",
		"dbname": "test",
		"idleTimeoutMillis": 30000,
		"refreshIdle": false,
		"maxConnection": 20,
		"connectionTimeout": 3000
	}
};