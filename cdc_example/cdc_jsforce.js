var bunyan = require('bunyan');
var jsforce = require('jsforce');
var lo = require('lodash');
var process = require('process');
var Q = require('q');
var yargs = require('yargs');

var logger = bunyan.createLogger({name: 'cdc_example'});

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
 * Process the data
 * @param {object} server_data The data from the server
 * @returns {undefined}
 */
var processdata = function (server_data) {
    // Do something more useful with the data
    logger.info(server_data);
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
 * Subscribe to the channel
 * @param {object} data The connection and arguments data
 * @returns {Promise} Promise for the subscription
 */
function subscribe(data) {
    var deferred = Q.defer();

    data.conn.streaming.topic(getCometdChannel(data.args)).subscribe(processdata);

    return deferred.promise;
}

/**
 * The monitoring subcommand
 * @param {object} args The arguments passed in
 * @returns {undefined}
 */
var monitor = function (args) {
    login(args)
        .then(subscribe)
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