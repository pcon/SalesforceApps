public virtual class OAuthController {
	@TestVisible private String access_token;
	@TestVisible private Boolean isCallback;

	public String application_name;

	/** The JSON result from a successful oauth call */
	public class OAuthResult {
		/** The access token */
		public String access_token {get; set;}

		/** The refresh token */
		public String refresh_token {get; set;}
	}

	/**
	* Validates the oauth code
	*
	* @param code The code to validate
	* @param redirect_uri The URL to redirect to after successful validation
	* @return The oauth result
	*/
	public OAuthResult validateCode(String code, String redirect_uri) {
		String client_id = OAuthApp__c.getValues(this.application_name).Client_Id__c;
		String client_secret = OAuthApp__c.getValues(this.application_name).Client_Secret__c;
		String access_token_url = OAuthApp__c.getValues(this.application_name).Access_Token_URL__c;

		List<String> urlParams = new List<String> {
			'grant_type=authorization_code',
			'code=' + EncodingUtil.urlEncode(code, 'UTF-8'),
			'client_id=' + EncodingUtil.urlEncode(client_id, 'UTF-8'),
			'client_secret=' + EncodingUtil.urlEncode(client_secret, 'UTF-8'),
			'redirect_uri=' + EncodingUtil.urlEncode(redirect_uri, 'UTF-8')
		};

		Http h = new Http();

		HttpRequest req = new HttpRequest();
		req.setEndpoint(access_token_url);
		req.setMethod('POST');
		req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
		req.setHeader('Accept', 'application/json');
		String body = String.join(urlParams, '&');
		req.setBody(body);

		HttpResponse res = h.send(req);
		return (OAuthResult)(JSON.deserialize(res.getBody(), OAuthResult.class));
	}

	/**
	* Generic constructor
	*/
	public OAuthController() {
	this.isCallback = ApexPages.currentPage().getParameters().containsKey('code');

		if (OAuthApp__c.getValues(this.application_name) != null) {
			this.access_token = OAuthApp__c.getValues(this.application_name).Access_Token__c;
		}
	}

	/**
	* Gets the authroization URL
	*
	* @return The authorization url
	*/
	public String getAuthUrl() {
		Map<String, String> urlParams = new Map<String, String> {
			'client_id' => OAuthApp__c.getValues(this.application_name).Client_Id__c,
			'redirect_uri' => getPageUrl(),
			'response_type' => 'code'
		};
		String auth_url = OAuthApp__c.getValues(this.application_name).Authorization_URL__c;

		PageReference ref = new PageReference(auth_url);
		ref.getParameters().putAll(urlParams);

		return ref.getUrl();
	}

	/**
	* Gets the page url
	*
	* @return The page url
	*/
	@testVisible
	private String getPageUrl() {
		String host = ApexPages.currentPage().getHeaders().get('Host');
		String path = ApexPages.currentPage().getUrl().split('\\?').get(0);

		return 'https://' + host + path;
	}

	/**
	* If the access token is set
	*
	* @return If the access token is set
	*/
	public Boolean getHasToken() {
		return (this.access_token != null);
	}

	/**
	* Validates the callback code and generates the access and refresh tokens
	*
	* @param location Where to redirect to after success
	* @return null to refresh the page
	*/
	public PageReference redirectOnCallback(PageReference location) {
		if (this.isCallback) {
			String code = ApexPages.currentPage().getParameters().get('code');
			OAuthResult result = validateCode(code, this.getPageUrl());

			OAuthApp__c creds = OAuthApp__c.getValues(this.application_name);
			creds.Access_Token__c = result.access_token;
			creds.Refresh_Token__c = result.refresh_token;
			update creds;

			return location;
		}

		return null;
	}
}