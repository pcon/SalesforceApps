#Salesforce Doc Rewriter Chrome Extension
On several occasions I have found myself looking at the old busted version of the Salesforce documentation and forgetting to (or even how to) get to the newest version.  This extension fixes that.

##What it does
This extension looks for a documentation url that starts with `http://www.salesforce.com/us/developer/docs/dbcom_apex250/` and replaces the `dbcom_apex250` with `apexcode` bringing you to the newest version of the documentation.  That's it.

##How to install it
###Easiest
* [Install](https://raw.githubusercontent.com/pcon/SalesforceApps/master/packages/docsRewriter.crx) the extension from the packages directory
###From source
* Clone the [SalesforceApps](https://github.com/pcon/SalesforceApps) repo
* Load the unpacked extension

##How to use it
Using it is as simple as visiting a link with the `dbcom_apex250` in the url. This [link](http://www.salesforce.com/us/developer/docs/dbcom_apex250/Content/apex_methods_system_datetime.htm) should automatically be redirected to this [link](http://www.salesforce.com/us/developer/docs/apexcode/Content/apex_methods_system_datetime.htm)