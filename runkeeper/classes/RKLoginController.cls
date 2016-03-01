/**
* A Visualforce controller for logging into Runkeeper
*
* @author Patrick Connelly (patrick@deadlypenguin.com)
*/
public virtual class RKLoginController {
	/** If we are handling the callback */
	private Boolean isCallback;

	/** The current user */
	protected User currentUser;

	/** If the current user has a token or not */
	protected Boolean hasToken;

	/** The url to redirect to for authentication */
	public String authUrl { public get; private set; }

	/**
	* Gets the current pages URL
	*
	* @return The current page's URL
	*/
	@testVisible
	private String getPageUrl() {
		String host = ApexPages.currentPage().getHeaders().get('Host');
		String path = ApexPages.currentPage().getUrl().split('\\?').get(0);

		return 'https://' + host + path;
	}

	/**
	* The constructor
	*/
	public RKLoginController() {
		this.isCallback = false;

		this.currentUser = [
			select RK_Access_Token__c
			from User
			where Id = :UserInfo.getUserId()
		];

		this.authUrl = RunkeeperUtils.getAuthUrl(this.getPageUrl());
		this.hasToken = (this.currentUser.RK_Access_Token__c != null);

		if (ApexPages.currentPage().getParameters().containsKey('code')) {
			this.isCallback = true;
		}
	}

	/**
	* If we are in a call back, fetch and save the access token for the user, then redirect to the list page
	*
	* @return The page to goto next
	*/
	public PageReference redirectOnCallback() {
		if (this.isCallback) {
			String code = ApexPages.currentPage().getParameters().get('code');
			RunkeeperUtils.OAuthResult result = RunkeeperUtils.validateCode(code, this.getPageUrl());

			this.currentUser.RK_Access_Token__c = result.access_token;
			update this.currentUser;

			return Page.RKList;
		}

		return null;
	}
}