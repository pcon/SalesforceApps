trigger BoxInsert on Account (after insert) {
    for (Account a : Trigger.new) {
        BoxController.createFolder(a.Id);
    }
}