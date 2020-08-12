# Domo Limit Importer
This script imports Limit data from Salesforce into Domo.  This was written as an example and has not been deployed to production or tested with long term data.

## Configuration
Copy the `config.example.json` file to `config.json` and fill out the Salesforce credentials fields and the Domo `client_id` and `client_secret` fields.  If you have not created a client you can do that by following [these steps](https://developer.domo.com/docs/authentication/quickstart-5).


## Running
1. Install the dependencies by running `npm install`
2. Run `node limitsDataset.js`

After the initial import the `dataset_id` will be added to your `config.json` file and the data will be added to that dataset moving forward.

## Notes
By default this only imports `DataStorageMB` and `FileStorageMB`.  More [limits](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_limits.htm) can be added by appending them to the `domo.limits` list in `config.json`.  This should work for most of the limits however there are more complex limits that this script would need to be modified to use.  This is mostly just an example.