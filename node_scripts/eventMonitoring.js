#!/usr/bin/env node

/*jslint browser: true, regexp: true */
/*global require, process */

var Q = require('q');
var bunyan = require('bunyan');
var Converter = require('csvtojson').Converter;
var filesize = require('filesize');
var fs = require('fs');
var lo = require('lodash');
var moment = require('moment');
var path = require('path');
var request = require('request');
var url = require('url');
var utils = require('./utils.js');

var app = require('commander');

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

/** The list of fields to query from the EventLogFile record */
var field_list = [
    'Id',
    'EventType',
    'LogFile',
    'LogDate',
    'LogFileLength'
];

app.version('1.0.0')
    .usage('[options]')
    .option('-d, --startdate [startdate]', 'The start date')
    .option('-e, --enddate [enddate]', 'The end date')
    .option('--json', 'Output files as json')
    .option('--csv', 'Output files as csv')
    .option('--env [env]', 'The environment name')
    .option('--dumpdir [dir]', 'The directory to dump files into')
    .parse(process.argv);

var app_config = {
    output_type: 'json'
};

/**
 * Formats the date in the format expected by SOQL
 * @param {moment} d - The date to format
 * @return The string version of the date
 */
function formatDate(d) {
    'use strict';

    return d.format('YYYY-MM-DDTHH:mm:ss.000\\Z');
}

/** Parses the command line arguments */
var parseArguments = function () {
    'use strict';

    var fs_stats,
        deferred = Q.defer();

    app_config.start_date = app.startdate === undefined ? moment().startOf('day').subtract(1, 'days') : moment(app.startdate).startOf('day');
    app_config.end_date = app.enddate === undefined ? moment(app_config.start_date).endOf('day') : moment(app.enddate).endOf('day');

    if (app.env) {
        utils.setCredentialsFromSolenopsisCredentials(app.env);
    }

    if (app.json) {
        app_config.output_type = 'json';
    } else if (app.csv) {
        app_config.output_type = 'csv';
    }

    if (app.dumpdir || global.config.options.data_dump_dir) {
        if (app.dumpdir) {
            lo.set(global.config, 'options.data_dump_dir', app.dumpdir);
        }

        try {
            /*jslint stupid: true, bitwise: true*/
            fs.accessSync(global.config.options.data_dump_dir, (fs.R_OK | fs.W_OK));
            fs_stats = fs.statSync(global.config.options.data_dump_dir);
            /*jslint stupid: false, bitwise: false*/

            if (!fs_stats.isDirectory()) {
                throw new Error(global.config.options.data_dump_dir + ' is not a directory');
            }
        } catch (error) {
            global.logger.error(error.message);
            global.logger.debug(error);
            process.exit(-1);
        }

        deferred.resolve();
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};

/** Query the event logs between the start and end date */
var queryEventTypes = function () {
    'use strict';

    var query_parts = {
            fields: field_list,
            object: 'EventLogFile',
            where: {
                and_criteria: [
                    {
                        field: 'LogDate',
                        comparator: '>=',
                        value: formatDate(app_config.start_date)
                    }, {
                        field: 'LogDate',
                        comparator: '<=',
                        value: formatDate(app_config.end_date)
                    }
                ]
            }
        };

    return utils.dynamicQuery(query_parts);
};

/**
 * Downloads a specific event log
 *
 * @param {string} filename - The file to save the data to
 * @param {string} url - The URI to download
 */
var getEventLog = function (filename, uri) {
    'use strict';

    var log_url,
        deferred = Q.defer(),
        converter_options = {
            constructResult: false,
            ignoreEmpty: true
        },
        csvConvert = new Converter(converter_options);

    global.logger.debug(filename + ' - Writing ' + uri);

    utils.login()
        .then(function (conn) {
            log_url = url.resolve(conn.instanceUrl, uri);

            csvConvert.on('record_parsed', function (json_data) {
                fs.appendFile(filename, JSON.stringify(json_data) + '\n', function (error) {
                    deferred.reject(error);
                });
            }).on('end_parsed', function () {
                global.logger.debug(filename + ' - Write complete');
            });

            if (app_config.output_type === 'json') {
                request.get(log_url, {auth: {bearer: conn.accessToken}})
                    .pipe(csvConvert)
                    .on('error', function (error) {
                        deferred.reject(error);
                    });
            } else {
                request.get(log_url, {auth: {bearer: conn.accessToken}})
                    .pipe(fs.createWriteStream(filename))
                    .on('error', function (error) {
                        deferred.reject(error);
                    });
            }
        });

    return deferred.promise;
};

/**
 * Iterates through all of the returned event logs and downloads them
 *
 * @param {Object[]} data - A list of all the EventLogFile records to download
 */
var getEventTypes = function (data) {
    'use strict';

    var filename, m,
        promises = [],
        deferred = Q.defer();

    global.logger.info('Found ' + lo.size(data) + ' Event Log Files');

    lo.forEach(data, function (row) {
        m = moment(row.LogDate);
        filename = m.format('YYYY-MM-DD') + '-' + row.EventType + '.' + app_config.output_type;
        // NOTE: The filesize here is for the CSV file.  Converting it to json almost doubles the total on disk filesize
        global.logger.info('Fetching ' + filesize(row.LogFileLength) + ' file for ' + row.EventType + ' => ' + filename);

        if (global.config.options.data_dump_dir) {
            filename = path.join(global.config.options.data_dump_dir, filename);
        }

        promises.push(getEventLog(filename, row.LogFile));
    });

    Q.allSettled(promises)
        .then(function () {
            deferred.resolve();
        });

    return deferred.promise;
};

Q.fcall(parseArguments)
    .then(queryEventTypes)
    .then(getEventTypes)
    .catch(function (error) {
        'use strict';

        global.logger.error(error);
    });