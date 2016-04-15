/*jslint browser: true, regexp: true */
/*global require, process, global */

var Q = require('q');
var bunyan = require('bunyan');
var lo = require('lodash');
var fs = require('fs');
var utils = require('./utils.js');
var args = require('minimist')(process.argv.slice(2));

var DATA_FILE = 'initial_data.json';

global.logger = bunyan.createLogger({
    name: 'initializeData',
    streams: [
        {
            level: 'debug',
            stream: process.stdout
        }, {
            level: 'warn',
            path: global.config.logging.file
        }
    ]
});

var parseArguments = function () {
    'use strict';

    var deferred = Q.defer();

    if (args.env) {
        utils.setCredentialsFromSolenopsisCredentials(args.env);
    }

    if (args.dataFile) {
        global.config.options.data_file = args.dataFile;
    }

    if (!global.config.options.data_file) {
        global.config.options.data_file = DATA_FILE;
    }

    deferred.resolve();

    return deferred.promise;
};

var loadDataFile = function () {
    'use strict';

    var deferred = Q.defer();

    global.logger.info('Loading data from "' + global.config.options.data_file + '"');

    fs.readFile(global.config.options.data_file, function (error, data) {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve(JSON.parse(data));
        }
    });

    return deferred.promise;
};

var processRecords = function myself(data, parentData) {
    'use strict';

    var compiled, inner_deferred, ids, query,
        parentMap = {},
        promises = [],
        deferred = Q.defer(),
        objectName = lo.get(data, 'ObjectName'),
        identifier = lo.get(data, 'Identifier');

    global.logger.debug('Inserting ' + lo.size(lo.get(data, 'Records')) + ' ' + objectName + ' records');

    if (parentData === null || parentData === undefined) {
        parentData = {};
    }

    lo.each(lo.get(data, 'Records'), function (record) {
        if (lo.has(record, 'ChildRecords')) {
            lo.set(parentMap, lo.get(record, identifier), lo.get(record, 'ChildRecords'));
            delete record.ChildRecords;
        }

        /*jslint unparam: true*/
        lo.transform(record, function (result, value, key) {
            compiled = lo.template(value);
            lo.set(record, key, compiled(parentData));
        });
        /*jslint unparam: false*/
    });

    utils.insert(objectName, lo.get(data, 'Records'))
        .then(function (results) {
            inner_deferred = Q.defer();

            ids = [];

            lo.each(results, function (result) {
                ids.push(lo.get(result, 'id'));
            });

            query = 'select ' + utils.join_parts_unescaped(lo.keys(lo.head(lo.get(data, 'Records')))) + ', Id from ' + objectName + ' where Id in (' + utils.join_parts(ids) + ')';

            utils.query(query)
                .then(function (query_results) {
                    inner_deferred.resolve(query_results);
                })
                .catch(function (error) {
                    global.logger.debug('Got a query error');
                    global.logger.debug(error);
                    inner_deferred.reject(error);
                });

            return inner_deferred.promise;
        }).then(function (results) {
            lo.each(results, function (result) {
                lo.each(lo.get(parentMap, lo.get(result, identifier)), function (child) {
                    promises.push(myself(child, result));
                });
            });

            Q.allSettled(promises)
                .then(function () {
                    deferred.resolve();
                });
        })
        .catch(function (error) {
            global.logger.debug('got an error');
            global.logger.debug(error);
            deferred.reject(error);
        });

    return deferred.promise;
};

var insertDataFromJSON = function (data) {
    'use strict';

    var promises = [];

    if (!lo.has(data, 'Insert')) {
        global.logger.warn('No data to insert');
    } else {
        lo.each(data.Insert, function (row) {
            promises.push(processRecords(row, null));
        });
    }

    return Q.all(promises);
};

Q.fcall(parseArguments)
    .then(loadDataFile)
    .then(insertDataFromJSON)
    .fail(function (error) {
        'use strict';
        global.logger.debug(error);
        global.logger.fatal(error.message);
    }).done(function () {
        'use strict';

        global.logger.debug('Done');
    });