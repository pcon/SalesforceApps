public class BoxController extends OAuthController {
    @TestVisible private static String APPLICATION_NAME = 'Box';
    @TestVisible private static String FOLDER_URL = 'https://api.box.com/2.0/folders';

    public BoxController() {
        this.application_name = APPLICATION_NAME;
    }

    /**
    * Validates the callback code and generates the access and refresh tokens
    *
    * @return null to refresh the page
    */
    public PageReference redirectOnCallback() {
        return super.redirectOnCallback(null);
    }

    private class ParentFolder {
        public String id;

        public ParentFolder(String id) {
            this.id = id;
        }
    }

    private class Folder {
        public String name;
        ParentFolder parent;

        public Folder(String name, String parentId) {
            this.name = name;
            this.parent = new ParentFolder(parentId);
        }
    }

    /**
    * Static method to create the folder inside of the box account
    *
    * @param accountId The account id to create the folder for
    */
    @Future(callout = true)
    public static void createFolder(Id accountId) {
        String access_token = OAuthApp__c.getValues(APPLICATION_NAME).Access_Token__c;
        Folder folder_info = new Folder(accountId, '0');

        HttpRequest request=new HttpRequest();
        request.setEndpoint(FOLDER_URL);
        request.setMethod('POST');
        request.setHeader('Authorization', 'Bearer ' + access_token);
        String body = JSON.serialize(folder_info);
        request.setBody(body);

        Http p = new Http();
        HttpResponse response = p.send(request);
    }
}