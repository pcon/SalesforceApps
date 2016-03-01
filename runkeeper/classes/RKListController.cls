/**
* A Visualforce controller displaying data from Runkeeper
*
* @author Patrick Connelly (patrick@deadlypenguin.com)
*/
public class RKListController extends RKLoginController {
	/** The recent activities for the user */
	public List<RunkeeperUtils.Activity> recentActivities { get; private set; }

	/**
	* The constructor
	*/
	public RKListController() {
		super();

		if (this.hasToken) {
			this.recentActivities = RunkeeperUtils.getRecentActivities(this.currentUser.RK_Access_Token__c);
			System.debug(System.LoggingLevel.ERROR, JSON.serializePretty(this.recentActivities));
		}
	}

	/**
	* If the user does not have a token log them in
	*
	* @return the page to goto based on the token availability
	*/
	public PageReference ensureHasToken() {
		if (this.hasToken) {
			return null;
		}

		return Page.RKLogin;
	}
}