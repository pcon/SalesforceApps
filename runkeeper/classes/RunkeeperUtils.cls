/**
* A utility class for interacting with Runkeeper
*
* @author Patrick Connelly (patrick@deadlypenguin.com)
*/
public class RunkeeperUtils {
	/** A map of the month to it's number */
	private static Map<String, Integer> MONTH_MAP = new Map<String, Integer>{
		'Jan' => 1,
		'Feb' => 2,
		'Mar' => 3,
		'Apr' => 4,
		'May' => 5,
		'Jun' => 6,
		'Jul' => 7,
		'Aug' => 8,
		'Sep' => 9,
		'Oct' => 10,
		'Nov' => 11,
		'Dec' => 12
	};

	/** The JSON result from a successful oauth call */
	public class OAuthResult {
		/** The access token */
		public String access_token { get; set; }

		/** The token type */
		public String token_type { get; set; }
	}

	/** The information about an activity */
	public class Activity {
		/** The start time */
		private String start_time;

		/** The distance in meters */
		public Double total_distance {get; private set;}

		/** The duration in seconds */
		public Double duration {get; private set;}

		/** The tracking mode */
		public String tracking_mode {get; private set;}

		/** The total calories burned */
		public Double total_calories {get; private set;}

		/** The source system */
		public String source {get; private set;}

		/** The entry mode */
		public String entry_mode {get; private set;}

		/** If GPS / path data exists for activity */
		public Boolean has_path {get; private set;}

		/** The type of the activity */
		public String primary_type {get; private set;}

		/** The URL for the activity in Runkeeper */
		public String uri {get; private set;}

		/**
		* Converts the distance from meters to miles
		*
		* @return The total_distance in miles
		*/
		public Double getTotal_distance_mi() {
			return (this.total_distance * 0.000621371).setScale(2);
		}

		/**
		* Converts the start time into a DateTime object
		*
		* @return The start_time in a DateTime format
		*/
		public DateTime getStart_time() {
			List<String> parts = this.start_time.split(' ');
			Integer y = Integer.valueOf(parts.get(3));
			Integer m = MONTH_MAP.get(parts.get(2));
			Integer d = Integer.valueOf(parts.get(1));
			List<String> t = parts.get(4).split(':');
			Integer h = Integer.valueOf(t.get(0));
			Integer mm = Integer.valueOf(t.get(1));
			Integer s = Integer.valueOf(t.get(2));

			return DateTime.newInstance(y, m, d, h, mm, s);
		}
	}

	/** The appication's client id */
	private static String CLIENT_ID = 'XXXXX';

	/** The appication's client secret */
	private static String CLIENT_SECRET = 'YYYYY';

	/** The API URL */
	public static String API_URL = 'https://api.runkeeper.com';

	/** The URL for getting the access code */
	public static String ACCESS_TOKEN_URL = 'https://runkeeper.com/apps/token';

	/** The URL for authorizing the request */
	public static String AUTHORIZE_URL = 'https://runkeeper.com/apps/authorize';

	/**
	* Replaces reserved words in the JSON to help with deserialization
	*
	* NOTE: Words like 'type' are reserved and must be renmaed for
	*       object based deserialization to work
	*
	* @param data The JSON
	* @return The updated JSON
	*/
	private static String fixReservedWords(String data) {
		return data.replace('"type"', '"primary_type"');
	}

	/**
	* Gets the authentication url
	*
	* @param redirect_url The url that the user should be redirected to after login
	* @return The url the user should be sent to in order to login
	*/
	public static String getAuthUrl(String redirect_uri) {
		Map<String, String> urlParams = new Map<String, String> {
			'client_id' => CLIENT_ID,
			'redirect_uri' => redirect_uri,
			'response_type' => 'code'
		};

		PageReference ref = new PageReference(AUTHORIZE_URL);
		ref.getParameters().putAll(urlParams);

		return ref.getUrl();
	}

	/**
	* Validates the oauth code
	*
	* @param code The code to validate
	* @param redirect_uri The URL to redirect to after successful validation
	* @return The oauth result
	*/
	public static OAuthResult validateCode(String code, String redirect_uri) {
		List<String> urlParams = new List<String> {
			'grant_type=authorization_code',
			'code=' + EncodingUtil.urlEncode(code, 'UTF-8'),
			'client_id=' + EncodingUtil.urlEncode(CLIENT_ID, 'UTF-8'),
			'client_secret=' + EncodingUtil.urlEncode(CLIENT_SECRET, 'UTF-8'),
			'redirect_uri=' + EncodingUtil.urlEncode(redirect_uri, 'UTF-8')
		};

		Http h = new Http();

		HttpRequest req = new HttpRequest();
		req.setEndpoint(ACCESS_TOKEN_URL);
		req.setMethod('POST');
		req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
		req.setHeader('Accept', 'application/json');
		String body = String.join(urlParams, '&');
		req.setBody(body);

		HttpResponse res = h.send(req);
		return (OAuthResult)(JSON.deserialize(res.getBody(), OAuthResult.class));
	}

	/**
	* Makes a call to runkeeper to get data
	*
	* @param access_token The access token for the user
	* @param content_type The accept type
	* @param uri The URI for the request
	* @return the raw JSON data for the request
	*/
	private static String getRunkeeperData(String access_token, String content_type, String uri) {
		String endpoint = API_URL + uri;
		Http h = new Http();

		HttpRequest req = new HttpRequest();
		req.setEndpoint(endpoint);
		req.setMethod('GET');
		req.setHeader('Accept', content_type);
		req.setHeader('Authorization', 'Bearer ' + access_token);

		HttpResponse res = h.send(req);

		return fixReservedWords(res.getBody());
	}

	/**
	* Gets the recent activity for the given access token
	*
	* @param access_token The acces token for the user
	* @return A list of recent activities
	*/
	public static List<Activity> getRecentActivities(String access_token) {
		String data = getRunkeeperData(access_token, 'application/vnd.com.runkeeper.FitnessActivityFeed+json', '/fitnessActivities');
		Map<String, Object> dataMap = (Map<String, Object>)(JSON.deserializeUntyped(data));

		return (List<Activity>)(JSON.deserialize((String)(JSON.serialize(dataMap.get('items'))), List<Activity>.class));
	}
}