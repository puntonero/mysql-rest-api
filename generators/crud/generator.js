var http = require('http');
var fs = require('fs');
var rmdir = require('rmdir');
var tables = require('./tables');
var commons = require('../commons');
var config;
var dbConfig;


var connection = require("../../api/dbConnection.js"); //instantiate connection provider


//Mocks the Response object from Express (for this file's purposes at least)
var response = {
	json: function(arg) {
		generate(arg.tables);
	}
};

var callback;
var dir;
var exceptions;
var conf;

exports.set = function(_configuration) {
	conf = _configuration;
};

var exportedMain = function(_callback) {
	var config = conf.generator.crud;
	var dbConfig = conf.mysql;
	dir = __dirname + "/../../api/routes/gen/crud/";
	exceptions = config.exceptions;
	callback = _callback
	connection.createPool(conf); //initiate connection pool
	rmdir(dir, function(){
		tables.getTables(connection, response, dbConfig.database);
	});
}
exports.generate = exportedMain;

// Main function
function generate(tables) {
	if (!tables.length) {
		console.log("No tables found.");
		process.exit();
		return;
	}
	commons.mkdirp(dir);
	for (i1 = 0; i1 < tables.length; i1++) {
		it: {
			var table = tables[i1];
			if (!table.fields) break it;
			var name = table.name;
			for (i2 = 0; i2 < exceptions.length; i2++) {
				if (name == exceptions[i2]) {
					break it;
				}
			}
			var fields = [];
			var fieldTypes = [];
			var keys = [];

			for (i2 = 0; i2 < table.fields.length; i2++) {
				fields.push(table.fields[i2].Field);
				fieldTypes.push(table.fields[i2].Type);
				keys.push(table.fields[i2].Key);
			}

			commons.saveToFile(routeCode(name, fields, fieldTypes, keys), dir + table.name + ".js", i1 == tables.length - 1, callback);

		}
	}
	if (tables.length) {
		console.log("CRUD generation done.")
	};
}

/* Create statements */

// Return the select statement
function select(name) {
	var statement = "SELECT :C FROM " + name + " WHERE :OU";
	return statement;
}

// Return the insert statement
function insert(name, fields) {
	var columns = "";
	var values = "";
	for (i = 0; i < fields.length; i++) {
		columns += fields[i];
		values += ":V_" + fields[i];
		if (i != fields.length - 1) {
			columns += ", ";
			values += ", ";
		}
	}
	var statement = "INSERT INTO " + name + " (" + columns + ") VALUES( " + values + " )";
	return statement;

}

// Return the delete statement
function deleteSt(name) {
	var statement = "DELETE FROM " + name + " WHERE :OR";
	return statement;
}

// Return the update statement
function update(name, fields) {
	var set = "";
	var statement = "UPDATE " + name + " SET :OC WHERE :OF";
	return statement;
}

// Generate javascript code for routes
function routeCode(tableName, fields, fieldTypes, keys) {
	var js = "";

	function add(line) {
		js += line + '\n';
	}
	add("var express = require(\"express\");");
	add("\n");
	add("/**");
	add(" * @function " + tableName);
	for (i = 0; i < fields.length; i++) {
		var temp = " *@param {" + fieldTypes[i] + "} " + fields[i];
		if (keys[i] != "") {
			temp += " - Key: " + keys[i];
		}
		add(temp);
	}
	add(" */");
	add("\n");
	add("exports.router = function (connection) {");
	add("	var router = express.Router();\n");

	add("	var create = express.Router();");
	add("	create.post(\"/add\", function (req, res) {");
	add("		connection.query(\"" + insert(tableName, fields) + "\", req.body, res);");
	add("	});");
	add(" 	router.use(\"/" + tableName + "\", create);\n");


	add("	var read = express.Router();");
	add("	read.post(\"/get\", function (req, res) {");
	add("		connection.query(\"" + select(tableName) + "\", req.body, res);");
	add("	});");
	add(" 	router.use(\"/" + tableName + "\", read);\n");

	add("	var update = express.Router();");
	add("	update.post(\"/update\", function (req, res) {");
	add("		connection.query(\"" + update(tableName, fields) + "\", req.body, res);");
	add("	});");
	add(" 	router.use(\"/" + tableName + "\", update);\n");

	add("	var deletePath = express.Router();");
	add("	deletePath.post(\"/delete\", function (req, res) {");
	add("		connection.query(\"" + deleteSt(tableName) + "\", req.body, res);");
	add("	});");
	add(" 	router.use(\"/" + tableName + "\", deletePath);\n");
	add("	return router;");
	add("}");

	return js;
}


// Write code into a file
function saveToFile(code, table, last) {
	var ws = fs.createWriteStream(dir + "/" + table + ".js", { //write into file
		flags: 'w',
		autoClose: true,
		fd: null,
	});
	ws.write(code);
	if (last) {
		ws.end(callback)
	};

}
