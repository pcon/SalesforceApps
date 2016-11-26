@RestResource(UrlMapping = '/TaskInsert/*')
global class TaskInsertWebServices {
	global class TaskWrapper {
		public String subject;
		public String priority;
		public String status;
		public String externalId;

		private transient Contact con;

		public Task getTask() {
			this.con = [
				select AccountId
				from Contact
				where External_Id__c = :this.externalId
			];

			return new Task(
				Subject = this.subject,
				Priority = this.priority,
				Status = this.status,
				WhatId = con.AccountId,
				WhoId = con.Id
			);
		}
	}

	@HttpPost
	global static List<Id> doPost(List<TaskWrapper> tasks) {
		List<Task> tasksToInsert = new List<Task>();

		for (TaskWrapper task : tasks) {
			tasksToInsert.add(task.getTask());
		}

		insert tasksToInsert;

		Map<Id, Task> taskMap = new Map<Id, Task>(tasksToInsert);
		return new List<Id>(taskMap.keySet());
	}
}