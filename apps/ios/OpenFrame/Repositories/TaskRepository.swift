import Foundation

final class TaskRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getTaskLists() async throws -> [TaskList] {
        try await apiClient.request(.getTaskLists)
    }

    func getTasks(listId: String? = nil, status: String? = nil) async throws -> [OFTask] {
        try await apiClient.request(.getTasks(listId: listId, status: status))
    }

    func createTask(taskListId: String, title: String, notes: String? = nil, dueDate: Date? = nil) async throws -> OFTask {
        var body: [String: Any] = ["taskListId": taskListId, "title": title]
        if let notes { body["notes"] = notes }
        if let dueDate { body["dueDate"] = ISO8601DateFormatter().string(from: dueDate) }
        return try await apiClient.request(.createTask(body: body))
    }

    func updateTask(id: String, updates: [String: Any]) async throws -> OFTask {
        try await apiClient.request(.updateTask(id: id, body: updates))
    }

    func completeTask(id: String) async throws {
        try await apiClient.requestVoid(.completeTask(id: id))
    }

    func deleteTask(id: String) async throws {
        try await apiClient.requestVoid(.deleteTask(id: id))
    }
}
