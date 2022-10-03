/**
 * Utility class around Salesforce connections
 *
 * @author Patrick Connelly <patrick@connelly.dev>
 * @since 1.0.0
 */

const isArray = require('lodash/isArray');
const join = require('lodash/join');
const concat = require('lodash/concat');
const map = require('lodash/map');

const cache = require('./cache');

const FULFILLED = 'fulfilled';

/**
 * Quotes a string
 * @param {String} s The string to quote
 * @returns {String} The quoted string
 */
function quoteString(s) {
    return `'${s}'`;
}

/**
 * Quotes an array of strings
 * @param {String[]} strings An array of strings to quote
 * @returns {String[]} The quoted strings
 */
function quoteStrings(strings) {
    return map(strings, quoteString);
}

/**
 * Generates the query string
 * @param {String[]} fields The fields to query
 * @param {String} object_name The object name
 * @param {String} where_clause The where clause
 * @param {String} order_clause The order clause
 * @param {String} limit_count The limit count
 * @returns {String} The query
 */
function generateQuery(fields, object_name, where_clause, order_clause, limit_count) {
    let parts = [
        'select',
        fields,
        `from ${object_name}`
    ];

    if (isArray(where_clause)) {
        parts.push(`where ${join(where_clause, ' AND ')}`);
    } else if (where_clause) {
        parts.push(`where ${where_clause}`);
    }

    if (order_clause) {
        parts.push(`order by ${order_clause}`);
    }

    if (limit_count) {
        parts.push(`limit ${limit_count}`);
    }

    return join(parts, ' ');
}

/**
 * Reads the metadata
 * @param {Object} conn The Salesforce connection
 * @param {String} type The metadata type
 * @param {String} full_name The metadata name
 * @returns {Promise} A promise for the metadata information
 */
function metadataRead(conn, type, full_name) {
    return new Promise(function (resolve, reject) {
        const hash = cache.hash(`${type}-${full_name}`, true);

        cache.read(hash)
            .then(resolve)
            .catch(function () {
                conn.metadata.read(type, full_name, function (error, results) {
                    if (error) {
                        reject(error);
                    } else {
                        cache.write(hash, results)
                            .then(resolve)
                            .catch(reject);
                    }
                });
            });
    });
}

/**
 * Splits all the full names into chunks and concatenates the results back together
 * @param {Object} conn The Salesforce connection
 * @param {String} type The metadata type
 * @param {String[]} full_names The metadata names
 * @returns {Promise} A promise for the metadata information
 */
function metadataReadAll(conn, type, full_names) {
    console.info(`Reading ${type} metadata for ${full_names.length} names`);

    return new Promise(function (resolve, reject) {
        const promises = [];

        full_names.forEach(function (full_name) {
            promises.push(metadataRead(conn, type, full_name));
        });

        Promise.allSettled(promises)
            .then(function (results) {
                let metadata = [];

                results.forEach(function (result) {
                    if (result.status === FULFILLED) {
                        metadata = concat(metadata, result.value);
                    } else {
                        console.error(result.reason);
                    }
                });

                resolve(metadata);
            })
            .catch(reject);
    });
}

/**
 * Lists the metadata
 * @param {Object} conn The Salesforce connection
 * @param {String} type The metadata type
 * @returns {Promise} A promise for the metadata
 */
function metadataList(conn, type) {
    const hash = cache.hash(`metadataList-${type}`, true);
    const types = [
        {
            type: type
        }
    ];

    return new Promise(function (resolve, reject) {
        cache.read(hash)
            .then(resolve)
            .catch(function () {
                conn.metadata.list(types, function (error, results) {
                    if (error) {
                        reject(error);
                    } else {
                        cache.write(hash, results)
                            .then(resolve)
                            .catch(reject);
                    }
                });
            });
    });
}

/**
 * Makes a Salesforce query
 * @param {Object} conn The Salesforce connection
 * @param {String} query The query
 * @returns {Promise} A promise for the query results
 */
function query(conn, query) {
    return new Promise(function (resolve, reject) {
        const hash = cache.hash(query, true);

        cache.read(hash)
            .then(resolve)
            .catch(function () {
                conn.query(query, function (error, results) {
                    if (error) {
                        reject(error);
                    } else {
                        cache.write(hash, results.records)
                            .then(resolve)
                            .catch(reject);
                    }
                });
            });
    });
}

/**
 * Makes a bulk query
 * @param {Object} conn The jsforce connection
 * @param {String} query The query
 * @returns {Promise} A promise for the data from the query
 */
function bulk_query(conn, query) {
    return new Promise(function (resolve, reject) {
        var results = [];
        const hash = cache.hash(query, true);

        cache.read(hash)
            .then(resolve)
            .catch(function () {
                conn.bulk.pollInterval = 5000;
                conn.bulk.pollTimeout = 600000;
                conn.bulk.query(query)
                    .on('record', function (data) {
                        results.push(data);
                    }).on('error', function (error) {
                        reject(error);
                    }).on('finish', function () {
                        cache.write(hash, results)
                            .then(resolve)
                            .catch(reject);
                    });
            });
    });
}

module.exports = {
    quoteString: quoteString,
    quoteStrings: quoteStrings,
    generateQuery: generateQuery,
    query: query,
    bulk_query: bulk_query,
    metadata: {
        read: metadataRead,
        readAll: metadataReadAll,
        list: metadataList
    }
};