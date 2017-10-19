# Object Describe Browser

When working with a large organization, you get to a point where you have so many objects and so many fields that it can be almost impossible to keep track of them all.  It can be very time consuming to dig through the setup menus to find field and relationship names.  To help combat this you can use [JSforce](https://jsforce.github.io/) and [Angular](https://angularjs.org/) to write a single page app to quickly visualize all of your objects and the information about them.

### Metadata API
The Metadata API can be a very powerful tool that can be used to describe lots of information about your organization's objects.  As great as the Metadata API is, it can be a very daunting thing to a new developer interacting with the platform.  This is why I chose to use [JSforce's](https://jsforce.github.io/document/#metadata-api) implementation of the Metadata API.  Not only can you easily use it from inside of VisualForce with Javascript, but you can also use it with [node.js](http://nodejs.org/), Canvas or my personal favorite way the command line.

## A Tour

### Object List
All of your objects are listed and quickly filterable

![Object List](https://raw.githubusercontent.com/pcon/SalesforceApps/master/documentation/img/objDesc_list.png)

### Object Description
After selecting an object from the side nav bar you can see lots of information about the object

![Object Description](https://raw.githubusercontent.com/pcon/SalesforceApps/master/documentation/img/objDesc_description.png)

### Object Fields
All of the fields, their API name, type and description are also displayed and are filterable and sortable

![Object Fields](https://raw.githubusercontent.com/pcon/SalesforceApps/master/documentation/img/objDesc_fields.png)

### Object Relationships
All of the related objects are also listed including the elusive relationship name

![Object Relationships](https://raw.githubusercontent.com/pcon/SalesforceApps/master/documentation/img/objDesc_relationship.png)

## How to Install it

### Option 1: Multipage
1. Create a new VisualForce page called `objDescMainTmpl` with [this content](https://raw.githubusercontent.com/pcon/SalesforceApps/master/objDesc/objDescMainTmpl.page)
2. Create another VisualForce page called `objDesc` with [this content](https://raw.githubusercontent.com/pcon/SalesforceApps/master/objDesc/objDesc.page)
3. Visit the `objDesc` VisualForce page to use it

### Option 2: Single page
1. Create a new VisualForce page called `objDesc` with [this content](https://raw.githubusercontent.com/pcon/SalesforceApps/master/objDesc/objDescSinglePage.page)
2. Visit the `objDesc` VisualForce page to use it

_If you are planning on expanding on this app, the multipage will make editing the layout much easier_

## How it works

This app is quite simple and [JSforce](https://jsforce.github.io/) does most of the heavy lifting for us and [Angular](https://angularjs.org/) does the rest.

```javascript
var conn = new jsforce.Connection({accessToken: '{!$API.Session_Id}'});
```
Here we setup our JSforce connection with the Session_Id of the current user

```javascript
angular.module('objDescApp', ['ui.router', 'ui.bootstrap']);
angular.module('objDescApp').config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
   'use strict';
   $urlRouterProvider.otherwise('/');
   
   $stateProvider
      .state('main', {
         url: '/',
         views: {
            "body": {
               template: '<h2>Select an object for more information</h2>'
            }
         }
      })
      .state('object', {
         url: '/{name}',
         views: {
            "body": {
               controller: 'ObjectDetailCtrl',
               templateUrl: '/apex/objDescMainTmpl'
            }
         }
      });
}]);
```
This code sets up our templates and routing information.  So if we update the hash to be `#/Case` we will load the object description HTML and the activate our `ObjectDetailCtrl` method to fetch the rest of the data.

```javascript
angular.module('objDescApp').controller('ObjectListCtrl', function ($scope) {
   $scope.loading_sidebar = true;

   conn.describeGlobal(function (error_describe, metadata) {
      $scope.objects = metadata.sobjects;
      $scope.loading_sidebar = false;
      $scope.$apply();
   });
});
```
When the app starts with no parameters we start by just loading the list of objects.  This sets our `$scope.loading_sidebar` variable to true so we can show the loading animation.  Then we get a description of all of the sobjects from the `describeGlobal` method of JSforce.  This then gets set on our `$scope.objects` for us to use in the sidebar HTML.

```html
<a ui-sref='object({ name: object.name })'>{{ object.label }}</a>
```
In our sidebar HTML we set the `ui-sref` attribute which well update our route when clicked

```javascript
angular.module('objDescApp').controller('ObjectDetailCtrl', ['$scope', '$stateParams', function ($scope, $stateParams) {
   $scope.loading_main = true;
   $scope.isDescriptionCollapsed = true;
   $scope.isFieldsCollapsed = false;
   $scope.isChildrenCollapsed = false;
   
   $scope.property_list = [
      [
         'activateable',
         'createable',
         'custom',
         'customSetting',
         'deletable',
         'deprecatedAndHidden'
      ], [ 
         'feedEnabled',
         'layoutable',
         'mergeable',
         'queryable',
         'replicateable',
         'searchLayoutable'
      ], [ 
         'searchable',
         'triggerable',
         'undeletable',
         'updateable'
      ]
   ];
   
   conn.describe($stateParams.name, function (error_describe, metadata) {
      $scope.current_object = metadata;
      $scope.fieldsPredicate = '';
      $scope.relationshipsPredicate = '';
      $scope.labelStyle = 'fa-sort';
      $scope.nameStyle = 'fa-sort';
      $scope.typeStyle = 'fa-sort';
      $scope.descStyle = 'fa-sort';
      $scope.childSObjectStyle = 'fa-sort';
      $scope.rnameStyle = 'fa-sort';
      $scope.fieldStyle = 'fa-sort';
      $scope.loading_main = false;
   
      $scope.$apply();
   });
}]);
```
The code is called when we have an object and we want to get it's information.  The `describe` method of JSforce returns all of the metadata for the requested object (stored in `$stateParams.name`).  This then gets stored as `$scope.current_object` for us to use in the display.

## Conclusion
This app shows how you can display lots of important data about your organizations metadata with very little effort.  With the framework setup here, the sky is the limit since you have almost full access to almost all of the APIs that the Salesforce platform offers.

[JSforce Documentation](https://jsforce.github.io/document/)