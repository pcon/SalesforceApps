/**
 * Utility class around caching
 *
 * @author Patrick Connelly <patrick@connelly.dev>
 * @since 1.0.0
 */

const fs = require('fs');
const jsonfile = require('jsonfile');
const moment = require('moment');
const path = require('path');

const config = require('./config.json');

/**
 * Gets the age in days since the file was last modified
 * @param {String} file_path The file path to check
 * @returns {Promise} A promise for the age in days
 */
function getAge(file_path) {
    return new Promise(function (resolve, reject) {
        fs.stat(file_path, function (err, stats) {
            if (err) {
                reject(err);
            } else {
                const age = moment().diff(moment(stats.mtime), 'days');

                if (age <= config.cache.expire) {
                    resolve(file_path);
                } else {
                    reject(new Error('File cache has expired'));
                }
            }
        });
    });
}

/**
 * Returns the cached data
 * @param {String} hash The path to the file
 * @returns {Promise} A promise for the cached data
 */
function read(hash) {
    return new Promise(function (resolve, reject) {
        const file = path.join(config.cache.dir, hash + '.json');

        getAge(file)
            .then(function () {
                jsonfile.readFile(file, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
            .catch(reject);
    });
}

/**
 * Writes the cache to disk
 * @param {String} hash The hash
 * @param {Object[]} data The data
 * @returns {Promise} A promise for when the cache is written
 */
function write(hash, data) {
    return new Promise(function (resolve, reject) {
        const file = path.join(config.cache.dir, hash + '.json');

        jsonfile.writeFile(file, data, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {String} str the input value
 * @param {Boolean} [asString=false] set to true to return the hash value as
 *     8-digit hex string instead of an integer
 * @param {Integer} [seed] optionally pass the hash of the previous chunk
 * @returns {Integer | String} The hash
 */
function hashFnv32a(str, asString, seed) {
    /*jshint bitwise:false */
    var i, l;
    var hval = seed === undefined ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i += 1) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if (asString) {
        // Convert to 8 digit hex string
        return ('0000000' + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
}

module.exports = {
    hash: hashFnv32a,
    read: read,
    write: write
};