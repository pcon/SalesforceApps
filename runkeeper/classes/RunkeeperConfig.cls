/**
* A configuration class for interacting with Runkeeper
*
* @author Patrick Connelly (patrick@deadlypenguin.com)
*/
public class RunkeeperConfig {
	/** The appication's client id */
	public static String CLIENT_ID = 'XXXXX';

	/** The appication's client secret */
	public static String CLIENT_SECRET = 'YYYYY';

	/** The API URL */
	public static String API_URL = 'https://api.runkeeper.com';

	/** The URL for getting the access code */
	public static String ACCESS_TOKEN_URL = 'https://runkeeper.com/apps/token';

	/** The URL for authorizing the request */
	public static String AUTHORIZE_URL = 'https://runkeeper.com/apps/authorize';
}