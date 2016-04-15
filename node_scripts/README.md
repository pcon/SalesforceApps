#Node Scripts
This is a collection of Salesforce related node scripts that I've written.  Most rely heavily on [jsforce](https://jsforce.github.io/)

##Installation and Configuration
1. Checkout the source and run `npm install`
2. Install [bunyan](https://github.com/trentm/node-bunyan#cli-usage) _All the scripts should use bunyan as the logging outputter.  Simply run them an pipe the results into `bunyan`_

You will need to copy the `config.js.sample` to `config.js` and fill out your information.  The scripts in here should also support [Solenopsis credential files](https://github.com/solenopsis/Solenopsis/wiki/1.1-Configuration#credentials-configuration) if you have [Solenopsis](https://github.com/solenopsis/Solenopsis) installed and configured.

#Scripts
##initializeData.js
This script will iterate over the `initial_data.json` file and insert the data.  It will recursively traverse the list and insert child records.  You can use [lodash's templating engine](https://lodash.com/docs#template) to insert other data.  The example json file shows this being done with the parent object's Id.

###Todo
* Figure out how to allow for grandchild objects to use Ids of grandparents in templates
* Add the ability to Update objects