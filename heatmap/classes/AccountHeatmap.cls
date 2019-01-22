/**
* A controller for generating an heatmap of contacts for an account
*
* @author Patrick Connelly (patrick@deadlypenguin.com)
*/
global class AccountHeatmap {
	/** How many miles away is considered "nearby" */
	public static Decimal MILEAGE_THRESHOLD = 20;

	/**
	* Convertes degrees to radians
	*
	* @param degree The degrees
	* @return The radians
	*/
	private static Double toRadians(Decimal degree){
		Double res = degree * 3.1415926 / 180;
		return res;
	}

	/**
	* Calculates the distance between to points
	* Taken from: http://salesforce.stackexchange.com/questions/557/calculate-distance-between-two-places-on-accounts-from-a-vf-page
	*
	* @param lat1 The first latitude point
	* @param lon1 The first longitude point
	* @param lat2 The second latitude point
	* @param lon2 The second longitude point
	* @return The distance between the two points
	*/
	public static Decimal calculateDistance(Decimal lat1, Decimal lon1, Decimal lat2, Decimal lon2) {
		Double radius = 6371.00;
		Double dLat = toRadians(lat2 - lat1);
		Double dLon = toRadians(lon2 - lon1);
		Double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *   Math.cos(toRadians(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
		Double c = 2 * Math.asin(Math.sqrt(a));

		return radius * c * .62;
	}

	/** The contact point on the map */
	global class ContactGeo {
		public Decimal lat;
		public Decimal lng;
		public Integer count;

		/**
		* The constructor
		*
		* @param c The contact
		*/
		public ContactGeo(Contact c) {
			this.lat = c.MailingLatitude;
			this.lng = c.MailingLongitude;
			this.count = 1;
		}

		/**
		* If the passed in contact is nearby the current point
		*
		* @param c The contact to compare
		* @return If the contact is "nearby"
		*/
		public Boolean isNearby(Contact c) {
			return (calculateDistance(this.lat, this.lng, c.MailingLatitude, c.MailingLongitude) <= MILEAGE_THRESHOLD);
		}

		/**
		* Increment the count variable
		*/
		public void incrementCount() {
			this.count++;
		}
	}

	/**
	* Constructor
	*
	* @param controller The standard controller
	*/
	public AccountHeatmap(ApexPages.StandardController controller) {}

	/**
	* Generates a list of contacts with latitude, longitude and how many are near that point
	*
	* @param accountId The account to look for
	* @return A list of contact points
	*/
	@RemoteAction
	global static List<ContactGeo> getContactGeos(String accountId) {
		List<ContactGeo> geos = new List<ContactGeo>();

		for (Contact c : [
			select MailingLatitude,
				MailingLongitude
			from Contact
			where AccountId = :accountId
		]) {

			Boolean nearby = false;

			for (ContactGeo cg : geos) {
				if (cg.isNearby(c)) {
					System.debug('Is nearby ' + cg);
					cg.incrementCount();
					nearby = true;
					break;
				} else {
					System.debug('Is not nearby ' + cg);
				}
			}

			if (!nearby) {
				geos.add(new ContactGeo(c));
			}
		}

		return geos;
	}
}