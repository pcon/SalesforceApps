# Object Permissions

The idea behind this script is to provide a CSV file for all users that have any access to a provided Salesforce object.  This script will output the user's id, username and true/false for the permissions that the user has.

## Requirements
* Nodejs (tested on v16.3.0)
* npm (tested on 7.15.1)
* Solenopsis style credential files (see below)

## Setup
### Credentials
This script uses [Solenopsis]() credential files to login to an instance.  This expects the following folder structure `$HOME/.solenopsis/credentials/environment.properties`.

As an example if you have a sandbox named `dev` you can create the following properties file at `$HOME/.solenopsis/credentials/dev.properties` with the contents below

```
username = user@example.com.dev
password = examplepassword
token = 123abc
url = https://test.salesforce.com
```

If you are trying to access a production instance you can create the following properties file at `$HOME/.solenopsis/credentials/prod.properties` with the same content as above but the `url` changed to `https://login.salesforce.com`

### Installation
1. Check out the repository and `cd` into the `objectPermissions` directory
2. Install the npm packages with `npm install`
3. Create the `_cache` directory in the `objectPermissions` directory

## Usage
To use the script call `index.js` with the following required flags
* `-e <env>` This is the environment name AKA the part of the Solenopsis credentials file before the `.properties` so `dev` or `prod` in the example above
* `-o <object>` The is the object name (eg. `Case`, `EmailMessage` `CustomObject__c`)
* `-f <filename>` The CSV file name to write to

You can optionally use the `--force` flag to overwrite the CSV file if it already exists on disk