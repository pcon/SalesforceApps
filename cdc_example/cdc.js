var cometd_lib = require('cometd');
var bunyan = require('bunyan');
var jsforce = require('jsforce');
var lo = require('lodash');
var process = require('process');
var Q = require('q');
var yargs = require('yargs');

var logger = bunyan.createLogger({name: 'cdc_example'});

// If this line goes above the jsforce declaration it fails
require('cometd-nodejs-client').adapt();
var cometd = new cometd_lib.CometD();

/**
 * Gets the change data capture url
 * @param {object} conn Connection details
 * @param {object} args Arguments
 * @returns {string} The change data capture url
 */
function getCometdURL(conn) {
    return conn.instanceUrl + '/cometd/44.0';
}

/**
 * Gets the channel name
 * @param {object} args The arguments
 * @returns {string} The channel
 */
function getCometdChannel(args) {
    var channel = '/data/' + args.object + 'ChangeEvents';

    if (lo.isEmpty(args.object)) {
        channel = '/data/ChangeEvents';
    } else if (lo.endsWith(args.object, '__c')) {
        channel = '/data/' + lo.trimEnd(args.object + '__c') + '__ChangeEvent';
    }

    return channel;
}

/**
 * Sets up the comet instance
 * @param {object} data The connection and arguments data
 * @returns {Promise} Promise for when cometd is setup
 */
var cometd_setup = function (data) {
    var deferred = Q.defer();
    var url = getCometdURL(data.conn, data.args);

    cometd.configure({
        appendMessageTypeToURL: false,
        requestHeaders: { Authorization: 'Bearer ' + data.conn.accessToken },
        url: url
    });

    deferred.resolve(data);

    return deferred.promise;
};

/**
 * Do the comet handshake
 * @param {object} data The connection and arguments data
 * @returns {Promise} Promise for when cometd handshake is complete
 */
var cometd_handshake = function (data) {
    var deferred = Q.defer();

    cometd.handshake(function (handshake) {
        if (handshake.successful) {
            deferred.resolve(data);
        } else {
            deferred.reject('Handshake failed');
        }
    });

    return deferred.promise;
};

/**
 * Process the data
 * @param {object} server_data The data from the server
 * @returns {undefined}
 */
var cometd_processdata = function (server_data) {
    // Do something more useful with the data
    logger.info(server_data);
};

/**
 * Subcribe to the comet channel
 * @param {object} data The connection and arguments data
 * @returns {Promise} Promise for when the subscription has happened
 */
var cometd_subscribe = function (data) {
    var deferred = Q.defer();

    cometd.subscribe(getCometdChannel(data.args), cometd_processdata);
    deferred.resolve();

    return deferred.promise;
};

/**
 * Login to Salesfoce
 * @param {object} args The arguments passed in
 * @returns {Promise} A promise for when the login has occurred
 */
var login = function (args) {
    var deferred = Q.defer();
    var config = {};

    if (args.sandbox) {
        config.loginUrl = 'https://test.salesforce.com';
    }

    var conn = new jsforce.Connection(config);
    conn.login(args.username, args.password + args.token, function (error) {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve({
                conn: conn,
                args: args
            });
        }
    });

    return deferred.promise;
};

/**
 * The monitoring subcommand
 * @param {object} args The arguments passed in
 * @returns {undefined}
 */
var monitor = function (args) {
    login(args)
        .then(cometd_setup)
        .then(cometd_handshake)
        .then(cometd_subscribe)
        .catch(function (error) {
            logger.error(error);
            process.exit(1);
        });
};

/**
 * Runs the command
 * @returns {Promise} A promise for when the command has been run
 */
var run = function () {
    var deferred = Q.defer();

    yargs.usage('$0 <cmd> [args]')
        .options({
            username: {
                describe: 'The Salesforce username',
                type: 'string'
            },
            password: {
                describe: 'The Salesforce password',
                type: 'string'
            },
            token: {
                describe: 'The Salesforce token',
                type: 'string'
            },
            sandbox: {
                describe: 'The Salesforce instance is a sandbox',
                type: 'boolean'
            }
        })
        .command(
            'monitor [object]',
            'Monitor an object',
            function (args) {
                args.positional('object', {
                    describe: 'The object name',
                    default: ''
                });
            },
            monitor
        ).argv;

    deferred.resolve();

    return deferred.promise;
};

run()
    .catch(function (error) {
        logger.error(error);
    });