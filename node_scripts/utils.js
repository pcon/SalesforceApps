/*jslint browser: true, regexp: true, es5: true */
/*global require, module, console, process, path, global */

var jsforce = require('jsforce');
var Q = require('q');
var lo = require('lodash');
var fs = require('fs');
var moment = require('moment');
var ini = require('ini');
var path = require('path');
var jsonFile = require('jsonfile');

global.config = require('./config.js').config;

var DEFAULT_ENV_NAME = 'prod';

var setCredentialsFromSolenopsisCredentials = function (env) {
    'use strict';

    if (env === undefined || lo.isEmpty(env)) {
        if (!lo.isEmpty(global.config.sfdc.host)) {
            env = global.config.sfdc.host;
        } else {
            env = DEFAULT_ENV_NAME;
        }
    }

    /*jslint stupid: true*/
    var solenopsis_config_path = path.join(process.env.HOME, '.solenopsis/credentials/', env + '.properties'),
        sol_config = ini.parse(fs.readFileSync(solenopsis_config_path, 'utf-8'));
    /*jslint stupid: false*/

    global.config.sfdc.name = env;
    global.config.sfdc.login_url = sol_config.url;
    global.config.sfdc.user = sol_config.username;
    global.config.sfdc.pass = sol_config.password + sol_config.token;
};

var login = function () {
    'use strict';

    var conn = new jsforce.Connection({
            loginUrl: global.config.sfdc.login_url
        }),
        deferred = Q.defer();

    global.logger.debug('Logging in as "' + global.config.sfdc.user + '"');

    conn.login(global.config.sfdc.user, global.config.sfdc.pass, function (error) {
        if (error) {
            deferred.reject(new Error(error));
        } else {
            deferred.resolve(conn);
        }
    });

    return deferred.promise;
};

var identity = function (conn) {
    'use strict';

    var deferred = Q.defer();

    conn.identity(function (error) {
        if (error) {
            deferred.reject(new Error(error));
        } else {
            deferred.resolve(conn);
        }
    });

    return deferred.promise;
};

var logout = function (conn) {
    'use strict';

    var deferred = Q.defer();

    conn.logout(function (error) {
        if (error) {
            deferred.reject(new Error(error));
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
};

var query = function (query) {
    'use strict';

    var deferred = Q.defer();

    login()
        .then(function (conn) {
            var d = Q.defer(),
                records = [];

            conn.query(query)
                .on('record', function (record) {
                    delete record.attributes;
                    records.push(record);
                }).on('end', function () {
                    d.resolve(records);
                }).on('error', function (error) {
                    d.reject(error);
                }).run({
                    autoFetch: true,
                    maxFetch: 5000
                });

            return d.promise;
        })
        .then(function (records) {
            deferred.resolve(records);
        })
        .catch(function (error) {
            deferred.reject(error);
        });

    return deferred.promise;
};

var insert = function (object_name, data) {
    'use strict';

    var allSuccessful = true,
        deferred = Q.defer();

    login()
        .then(function (conn) {
            conn.sobject(object_name).create(data, function (error, results) {
                lo.each(results, function (result) {
                    if (!result.success) {
                        allSuccessful = false;
                    }
                });

                if (error || !allSuccessful) {
                    if (global.failed_create === undefined) {
                        global.failed_create = [];
                    }

                    global.failed_create.push({error: error, data: data});

                    deferred.reject(error);
                } else {
                    deferred.resolve(results);
                }
            });
        })
        .catch(function (error) {
            deferred.reject(error);
        });

    return deferred.promise;
};

var update = function (object_name, data) {
    'use strict';

    var deferred = Q.defer();

    login()
        .then(function (conn) {
            conn.sobject(object_name).update(data, function (error, result) {
                if (error || !result.success) {
                    if (global.failed_create === undefined) {
                        global.failed_create = [];
                    }

                    global.failed_create.push({error: error, data: data});

                    deferred.reject(error);
                } else {
                    deferred.resolve(result);
                }
            });
        })
        .catch(function (error) {
            deferred.reject(error);
        });

    return deferred.promise;
};

var writeCache = function (cache_file, data) {
    'use strict';

    var deferred = Q.defer();

    jsonFile.writeFile(cache_file, data, function (error) {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
};

var readCache = function (cache_file) {
    'use strict';

    var deferred = Q.defer();

    jsonFile.readFile(cache_file, function (error, data) {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise;
};

var capitalizeFirstLetter = function (string) {
    'use strict';

    return string.charAt(0).toUpperCase() + string.slice(1);
};

var string_escape = function (element) {
    'use strict';

    return '\'' + element.replace(/'/, '\\\'') + '\'';
};

var join_parts = function (data) {
    'use strict';

    var result = [];

    lo.each(data, function (row) {
        result.push(string_escape(row));
    });

    return result.join(',');
};

var join_parts_unescaped = function (data) {
    'use strict';

    var result = [];

    lo.each(data, function (row) {
        result.push(row);
    });

    return result.join(',');
};


module.exports = {
    capitalizeFirstLetter: capitalizeFirstLetter,
    identity: identity,
    insert: insert,
    join_parts: join_parts,
    join_parts_unescaped: join_parts_unescaped,
    login: login,
    logout: logout,
    query: query,
    readCache: readCache,
    setCredentialsFromSolenopsisCredentials: setCredentialsFromSolenopsisCredentials,
    string_escape: string_escape,
    update: update,
    writeCache: writeCache
};