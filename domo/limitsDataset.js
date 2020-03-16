const axios = require('axios');
const ClientOAuth2 = require('client-oauth2');
const jsforce = require('jsforce');
const jsonfile = require('jsonfile');
const lodash = require('lodash');

const config = require('./config.json');

const domo_config = {
    clientId: config.domo.client_id,
    clientSecret: config.domo.client_secret,
    accessTokenUri: 'https://api.domo.com/oauth/token',
    authorizationUri: '',
    scopes: config.domo.scopes
};

const dataset_fields = [
    {
        type: 'STRING',
        name: 'Name'
    },
    {
        type: 'DECIMAL',
        name: 'Max'
    },
    {
        type: 'DECIMAL',
        name: 'Remaining'
    }
];

const dataset = {
    name: 'Salesforce Limits',
    description: 'Salesforce limit data',
    rows: 0,
    schema: {
        columns: lodash.map(dataset_fields, function (obj) {
            return lodash.pick(obj, ['name', 'type']);
        })
    }
};

var dataset_id;

var domoAuth = new ClientOAuth2(domo_config);
var domoUser;
var sfdcConn = new jsforce.Connection({
    loginUrl: config.salesforce.sandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com'
});

String.prototype.isBlank = function () {
    return this.length === 0 || !this.trim();
};

/**
 * Gest axios headers for a given token
 * @param {String} token The access token
 * @returns {Object} The axios headers
 */
function getBearerHeaders(token) {
    return {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
}

/**
 * Stores the user data for later use
 * @param {Object} user The domo user information
 * @returns {Promise} A promise for when the user data is stored
 */
function storeDomoUser(user) {
    return new Promise(function (resolve) {
        domoUser = user;
        resolve();
    });
}

/**
 * If we've not created a dataset create one and write it to the config
 * @returns {Promise} A promise for when the dataset is created and stored
 */
function createDataSet() {
    return new Promise(function (resolve, reject) {
        if (config.domo.dataset_id && !config.domo.dataset_id.isBlank()) {
            dataset_id = config.domo.dataset_id;
            resolve();
        } else {
            const url = 'https://api.domo.com/v1/datasets';
            const opts = getBearerHeaders(domoUser.accessToken);

            axios.post(url, dataset, opts)
                .then(function (response) {
                    dataset_id = response.data.id;

                    const config_format = {
                        spaces: 4
                    };
                    config.domo.dataset_id = dataset_id;

                    jsonfile.writeFile('./config.json', config, config_format, function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }).catch(function (err) {
                    reject(err);
                });
        }
    });
}

/**
 * Authenticates against Salesforce
 * @returns {Promise} A promise for when the connection has been established
 */
function salesforceAuth() {
    return new Promise(function (resolve, reject) {
        sfdcConn.login(config.salesforce.username, config.salesforce.password + config.salesforce.token, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Gets the limit data
 * @returns {Promise} A promise for when the limit data has been retrieved
 */
function getLimitData() {
    return new Promise(function (resolve, reject) {
        const url = `${sfdcConn.instanceUrl}/services/data/v${config.salesforce.api_version}/limits`;
        const opts = getBearerHeaders(sfdcConn.accessToken);

        axios.get(url, opts)
            .then(function (res) {
                resolve(res.data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * Returns a subset of the limit data
 * @param {Object[]} limit_data The limit data
 * @returns {Promise} A promise for a subset of the limit data
 */
function transformLimitData(limit_data) {
    return new Promise(function (resolve) {
        const subset = lodash.pick(limit_data, config.domo.limits);
        const mapped_data = lodash.map(subset, function (value, key) {
            value.Name = key;
            return value;
        });
        resolve(mapped_data);
    });
}

/**
 * Generates a row of CSV data
 * @param {Object} data A single row of limit data
 * @returns {String} A single row of CSV data
 */
function generateCSVRow(data) {
    var row = [];

    lodash.forEach(dataset_fields, function (field) {
        row.push(lodash.get(data, field.name));
    });

    return lodash.join(row);
}

/**
 * Generates the CSV data based on the limit data
 * @param {Object[]} limit_data The limit data
 * @returns {Promise} A promise for when the CSV data has been generated
 */
function generateCSV(limit_data) {
    return new Promise(function (resolve) {
        var rows = [];

        lodash.forEach(limit_data, function (data) {
            rows.push(generateCSVRow(data));
        });

        resolve(lodash.join(rows, '\n'));
    });
}

/**
 * Imports the data to Domo
 * @param {String} csv_data The CSV data to import
 * @returns {Promise} A promise for when the data has been imported
 */
function importData(csv_data) {
    return new Promise(function (resolve, reject) {
        const url = `https://api.domo.com/v1/datasets/${dataset_id}/data`;
        var opts = getBearerHeaders(domoUser.accessToken);
        opts.headers['Content-Type'] = 'text/csv';

        axios.put(url, csv_data, opts)
            .then(resolve)
            .catch(reject);
    });
}

domoAuth.credentials.getToken()
    .then(storeDomoUser)
    .then(createDataSet)
    .then(salesforceAuth)
    .then(getLimitData)
    .then(transformLimitData)
    .then(generateCSV)
    .then(importData)
    .then(function () {
        const url = `https://${domoUser.data.domain}/datasources/${config.domo.dataset_id}/details/data`
        console.log('Data successfully imported.');
        console.log(`View your data ${url}`);
    })
    .catch(function (err) {
        console.error(err);
    });