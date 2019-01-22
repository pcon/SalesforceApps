#!/usr/bin/env node

/*jslint browser: true, regexp: true */
/*global require, process */

var Q = require('q');
var bunyan = require('bunyan');
var Converter = require('csvtojson').Converter;
var cradle = require('cradle');
var filesize = require('filesize');
var fs = require('fs');
var lo = require('lodash');
var moment = require('moment');
var path = require('path');
var request = require('request');
var targz = require('tar.gz');
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
            level: 'info',
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
    .option('--couchdb', 'Outputs to couchdb')
    .option('--compress', 'Compresses the outputted files by day')
    .option('--env [env]', 'The environment name')
    .option('--dumpdir [dir]', 'The directory to dump files into')
    .parse(process.argv);

var app_config = {
    output_type: 'json',
    compress: false
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

    if (app_config.start_date.isSameOrAfter(app_config.end_date)) {
        global.logger.error('End date must be after or the same as the start date');
        process.exit(-1);
    }

    if (app.env) {
        utils.setCredentialsFromSolenopsisCredentials(app.env);
    }

    if (app.json) {
        app_config.output_type = 'json';
    } else if (app.couchdb) {
        app_config.output_type = 'couchdb';
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
    }

    if ((app_config.output_type === 'json' || app_config.output_type === 'csv') && !global.config.options.data_dump_dir) {
        global.logger.error('The data dump directory must be set when using ' + app_config.output_type);
        process.exit(-1);
    }

    if (app.compress) {
        app_config.compress = true;
    }

    if (app_config.output_type !== 'json' && app_config.output_type !== 'csv' && app_config.compress) {
        global.logger.info('Compression not supported for ' + app_config.output_type + ' skipping');
        app_config.compress = false;
    }

    if (app_config.output_type === 'couchdb') {
        app_config.couchdb = new (cradle.Connection)(global.config.couch_db.host, global.config.couch_db.port, {cache: false, auth: {username: global.config.couch_db.user, password: global.config.couch_db.pass}}).database(global.config.couch_db.db);

        app_config.couchdb.exists(function (error, exists) {
            if (error) {
                deferred.reject(error);
            } else if (!exists) {
                app_config.couchdb.create(function (create_error) {
                    if (create_error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve();
                    }
                });
            } else {
                deferred.resolve();
            }
        });
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
 * Writes the data to the file
 *
 * @param {string} filename - The file to write to
 * @param {string} data - The data to write
 */
var writeToFile = function (filename, data) {
    'use strict';

    var deferred = Q.defer();

    fs.appendFile(filename, data, function (error) {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
};

/**
 * Writes the data to a couchdb
 *
 * @param {Object} data - The object to write
 */
var writeToCouchDB = function (data) {
    'use strict';

    var deferred = Q.defer();

    app_config.couchdb.save(data, function (error, result) {
        if (error) {
            global.logger.error(error);
            deferred.reject(error);
        } else {
            global.logger.debug('Saved ' + lo.size(result) + ' records to couchdb');
            deferred.resolve();
        }
    });

    return deferred.promise;
};

/**
 * Downloads the CSV and converts it to json
 *
 * @param {string} filename - The filename to write to
 * @param {string} log_url - The URL to download
 * @param {string} token - The bearer token
 */
var processJSON = function (filename, log_url, token) {
    'use strict';

    var deferred = Q.defer(),
        batch_count = 0,
        batch = [],
        promises = [],
        converter_options = {
            constructResult: false,
            ignoreEmpty: true
        },
        csvConvert = new Converter(converter_options);

    csvConvert.on('record_parsed', function (json_data) {
        if (app_config.output_type === 'json') {
            promises.push(writeToFile(filename, JSON.stringify(json_data) + '\n'));
        } else if (app_config.output_type === 'couchdb') {
            if (global.config.couch_db.batch) {
                batch_count += 1;

                if (batch_count === global.config.couch_db.batch) {
                    batch.push(json_data);
                    promises.push(writeToCouchDB(batch));
                    batch_count = 0;
                    batch = [];
                } else {
                    batch.push(json_data);
                }
            } else {
                promises.push(writeToCouchDB(json_data));
            }
        }
    }).on('end_parsed', function () {
        if (!lo.isEmpty(batch)) {
            promises.push(writeToCouchDB(batch));
            batch_count = 0;
            batch = [];
        }

        Q.all(promises)
            .then(function () {
                global.logger.info(filename + ' - Write complete');

                deferred.resolve();
            }).catch(function (error) {
                deferred.reject(error);
            });
    }).on('error', function () {
        global.logger.error('Error parsing CSV file.  Writing batch of ' + lo.size(batch));

        if (!lo.isEmpty()) {
            promises.push(writeToCouchDB(batch));
        }

        batch_count = 0;
        batch = [];
    });

    request.get(log_url, {auth: {bearer: token}})
        .pipe(csvConvert)
        .on('error', function (error) {
            deferred.reject(error);
        });

    return deferred.promise;
};

/**
 * Downloads the CSV and writes it to the file
 *
 * @param {string} filename - The file to write to
 * @param {string} log_url - The URL to read from
 * @param {string} token - The bearer token to use
 */
var processCSV = function (filename, log_url, token) {
    'use strict';

    var deferred = Q.defer();

    request.get(log_url, {auth: {bearer: token}})
        .pipe(fs.createWriteStream(filename))
        .on('finish', function () {
            global.logger.info(filename + ' - Write complete');
            deferred.resolve();
        }).on('error', function (error) {
            global.logger.error(error);
            deferred.reject(error);
        });

    return deferred.promise;
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
        deferred = Q.defer();

    global.logger.debug(filename + ' - Writing ' + uri);

    utils.login()
        .then(function (conn) {
            log_url = url.resolve(conn.instanceUrl, uri);

            if (app_config.output_type === 'json' || app_config.output_type === 'couchdb') {
                processJSON(filename, log_url, conn.accessToken)
                    .then(function () {
                        deferred.resolve();
                    }).catch(function (error) {
                        deferred.reject(error);
                    });
            } else if (app_config.output_type === 'csv') {
                processCSV(filename, log_url, conn.accessToken)
                    .then(function () {
                        deferred.resolve();
                    }).catch(function (error) {
                        deferred.reject(error);
                    });
            }
        });

    return deferred.promise;
};

/**
 * Recursively gets the first event type
 *
 * @param {Object[]} data - A list of the EventLogFile records to process
 * @param {Object} deferred - The Q promise to handle
 */
var getEventType = function self(data, deferred) {
    'use strict';

    var row, filename, dirname, m, dir_path, file_path, fs_stats;

    if (lo.isEmpty(data)) {
        deferred.resolve();
    } else {
        row = lo.head(data);

        m = moment.utc(row.LogDate);
        if (app_config.output_type === 'couchdb') {
            filename = m.format('YYYY-MM-DD') + '-' + row.EventType;
        } else {
            dirname = m.format('YYYY-MM-DD');
            dir_path = path.join(global.config.options.data_dump_dir, dirname);
            filename = m.format('YYYY-MM-DD') + '-' + row.EventType + '.' + app_config.output_type;
            file_path = path.join(dir_path, filename);

            /*jslint stupid: true, bitwise: true*/
            try {
                fs.accessSync(dir_path, (fs.R_OK | fs.W_OK));
                global.logger.debug('directory ' + dir_path + ' exists.  Skipping creation');
            } catch (error) {
                fs.mkdirSync(dir_path);
            }

            fs_stats = fs.statSync(dir_path);
            /*jslint stupid: false, bitwise: false*/

            if (!fs_stats.isDirectory()) {
                throw new Error(dir_path + ' is not a directory');
            }
        }

        // NOTE: The filesize here is for the CSV file.  Converting it to json almost doubles the total on disk filesize
        global.logger.info('Fetching ' + filesize(row.LogFileLength) + ' file for ' + row.EventType + ' => ' + filename);

        getEventLog(file_path, row.LogFile)
            .then(function () {
                self(lo.slice(data, 1), deferred);
            }).catch(function (error) {
                global.logger.error('Got error "' + error.message + '". Continuing.');
                self(lo.slice(data, 1), deferred);
            });
    }
};

/**
 * Iterates through all of the returned event logs and downloads them
 *
 * @param {Object[]} data - A list of all the EventLogFile records to download
 */
var getEventTypes = function (data) {
    'use strict';

    var deferred = Q.defer();

    global.logger.info('Found ' + lo.size(data) + ' Event Log Files');

    getEventType(data, deferred);

    return deferred.promise;
};

/**
 * Deletes the folder for the given day
 *
 * @param {String} day - The formatted date to use
 */
var deleteDay = function (day) {
    'use strict';

    var dir_path = path.join(global.config.options.data_dump_dir, day),
        deferred = Q.defer();

    global.logger.info('Deleting directory for ' + day);
    utils.deleteFolderRecursive(dir_path);
    deferred.resolve();

    return deferred.promise;
};

/**
* Compresses a day into a bzip2 file
*
* @param {String} day - The formatted date to use
*/
var compressDay = function (day) {
    'use strict';

    var read, write,
        dir_path = path.join(global.config.options.data_dump_dir, day),
        out_path = path.join(global.config.options.data_dump_dir, day + '.tar.gz'),
        deferred = Q.defer();

    global.logger.info('Compressing files for ' + day);

    read = targz().createReadStream(dir_path);
    write = fs.createWriteStream(out_path);

    read.pipe(write, {end: false});

    read.on('end', function () {
        global.logger.debug('Compression complete');

        deleteDay(day)
            .then(function () {
                deferred.resolve();
            }).catch(function (error) {
                global.logger.debug('Error deleting files ' + error.message);
                deferred.reject(error);
            });
    });

    read.on('error', function (error) {
        global.logger.debug('Error tarring file ' + error.message);
        deferred.reject(error);
    });

    deferred.resolve();

    return deferred.promise;
};

/**
* Compresses the files on disk to a bzip2 and removes the old files
*/
var compressFiles = function () {
    'use strict';

    var i,
        promises = [],
        deferred = Q.defer();

    if (app_config.compress) {
        for (i = 0; i <= app_config.end_date.diff(app_config.start_date, 'days'); i += 1) {
            promises.push(compressDay(app_config.start_date.add(i).format('YYYY-MM-DD')));
        }

        Q.allSettled(promises)
            .then(function () {
                deferred.resolve();
            }).catch(function (error) {
                global.logger.error('Got an error compressing files ' + error.message);
                deferred.reject(error);
            });
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};


Q.fcall(parseArguments)
    .then(queryEventTypes)
    .then(getEventTypes)
    .then(compressFiles)
    .catch(function (error) {
        'use strict';

        global.logger.error(error);
    });