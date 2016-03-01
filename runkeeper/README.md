#Runkeeper Utilities
If you've wanted to pull data from Runkeeper and store / display it in yourSalforce instance, then this code should help you!

##What it does
The classes and Visualforce page provide the groundwork for logging into Runkeeper and fetching a list of recent activities.  Hopefully over time I'll added more features to it (patches welcome)

##How to install it
###From source
* Clone the [SalesforceApps](https://github.com/pcon/SalesforceApps) repo
* Install the [RunkeeperUtils](https://raw.githubusercontent.com/pcon/SalesforceApps/master/runkeeper/classes/RunkeeperUtils.cls), [RKLoginController](https://raw.githubusercontent.com/pcon/SalesforceApps/master/runkeeper/classes/RKLoginController.cls) and [RKLogin](https://raw.githubusercontent.com/pcon/SalesforceApps/master/runkeeper/pages/RKLogin.page)
* Update `RunkeeperUtils` to contain your `CLIENT_ID` and `CLIENT_SECRET` and update `RKLoginController` to point to your success page.  Take a look at [RKList](https://raw.githubusercontent.com/pcon/SalesforceApps/master/runkeeper/pages/RKList.page) for an example.

Get Step-by-step instructions [here](http://blog.deadlypenguin.com/blog/2014/07/10/runkeeper-data-in-salesforce/)