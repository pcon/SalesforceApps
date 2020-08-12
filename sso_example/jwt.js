var axios = require('axios');
var fs = require('fs');
var jsforce = require('jsforce');
var jwt = require('jsonwebtoken');
var moment = require('moment');
var querystring = require('querystring');
var url = require('url');

var privatekey = fs.readFileSync('certs/key.pem');
var credentials = require('./credentials.js');

var jwtparams = {
    iss: credentials.salesforce.consumer_key,
    prn: credentials.salesforce.username,
    aud: credentials.salesforce.url,
    exp: parseInt(moment().add(2, 'minutes').format('X'))
};

var token = jwt.sign(jwtparams, privatekey, { algorithm: 'RS256' });

var params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: token
};

var token_url = new url.URL('/services/oauth2/token', credentials.salesforce.url).toString();

axios.post(token_url, querystring.stringify(params))
    .then(function (res) {
        var conn = new jsforce.Connection({
            instanceUrl: res.data.instance_url,
            accessToken: res.data.access_token
        });

        conn.query('select CaseNumber, Subject from Case limit 1', function (err, results) {
            console.log(JSON.stringify(results.records[0])); // eslint-disable-line no-console
        });
    });