import { google, tasks_v1 } from "googleapis";

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: "needsAction" | "completed";
  due?: string;
  completed?: string;
  updated: string;
  position: string;
  parent?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

export class GoogleTasksService {
  private tasks: tasks_v1.Tasks;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.tasks = google.tasks({ version: "v1", auth });
  }

  async getTaskLists(): Promise<GoogleTaskList[]> {
    const response = await this.tasks.tasklists.list();
    const items = response.data.items || [];

    return items.map((item) => ({
      id: item.id!,
      title: item.title!,
      updated: item.updated!,
    }));
  }

  async getTasks(taskListId: string): Promise<GoogleTask[]> {
    const allTasks: GoogleTask[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.tasks.tasks.list({
        tasklist: taskListId,
        showCompleted: true,
        showHidden: true,
        maxResults: 100,
        pageToken,
      });

      const items = response.data.items || [];
      for (const item of items) {
        allTasks.push({
          id: item.id!,
          title: item.title || "",
          notes: item.notes || undefined,
          status: (item.status as "needsAction" | "completed") || "needsAction",
          due: item.due || undefined,
          completed: item.completed || undefined,
          updated: item.updated!,
          position: item.position!,
          parent: item.parent || undefined,
        });
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return allTasks;
  }

  async createTask(
    taskListId: string,
    task: { title: string; notes?: string; due?: string }
  ): Promise<GoogleTask> {
    const response = await this.tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: {
        title: task.title,
        notes: task.notes,
        due: task.due,
      },
    });

    return {
      id: response.data.id!,
      title: response.data.title || "",
      notes: response.data.notes || undefined,
      status: (response.data.status as "needsAction" | "completed") || "needsAction",
      due: response.data.due || undefined,
      completed: response.data.completed || undefined,
      updated: response.data.updated!,
      position: response.data.position!,
      parent: response.data.parent || undefined,
    };
  }

  async updateTask(
    taskListId: string,
    taskId: string,
    updates: { title?: string; notes?: string; status?: "needsAction" | "completed"; due?: string }
  ): Promise<GoogleTask> {
    const response = await this.tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: {
        title: updates.title,
        notes: updates.notes,
        status: updates.status,
        due: updates.due,
      },
    });

    return {
      id: response.data.id!,
      title: response.data.title || "",
      notes: response.data.notes || undefined,
      status: (response.data.status as "needsAction" | "completed") || "needsAction",
      due: response.data.due || undefined,
      completed: response.data.completed || undefined,
      updated: response.data.updated!,
      position: response.data.position!,
      parent: response.data.parent || undefined,
    };
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    await this.tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId,
    });
  }

  async completeTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask(taskListId, taskId, { status: "completed" });
  }
}
