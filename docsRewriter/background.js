/*jslint browser: true, regexp: true */
/*global chrome */


chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		'use strict';

		return {
			redirectUrl: details.url.replace('dbcom_apex250', 'apexcode')
		};
	},
	{
		urls: [
			"*://www.salesforce.com/us/developer/docs/dbcom_apex250/*"
		],
		types: [
			"main_frame"
		]
	},
	[
		"blocking"
	]
);