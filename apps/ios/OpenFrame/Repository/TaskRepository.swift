import Foundation

final class TaskRepository: Sendable {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getTaskLists() async -> Result<[TaskList], Error> {
        do {
            let dtos: [TaskListDTO] = try await apiClient.requestData(.get, path: "/api/v1/tasks/lists")
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func getTasks(listId: String? = nil, status: String? = nil) async -> Result<[OFTask], Error> {
        do {
            var query: [String: String] = [:]
            if let listId { query["listId"] = listId }
            if let status { query["status"] = status }
            let dtos: [TaskDTO] = try await apiClient.requestData(.get, path: "/api/v1/tasks", query: query.isEmpty ? nil : query)
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func createTask(taskListId: String, title: String, notes: String? = nil, dueDate: String? = nil) async -> Result<OFTask, Error> {
        do {
            let body = CreateTaskRequest(taskListId: taskListId, title: title, notes: notes, dueDate: dueDate)
            let dto: TaskDTO = try await apiClient.requestData(.post, path: "/api/v1/tasks", body: body)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func completeTask(id: String) async -> Result<OFTask, Error> {
        do {
            let dto: TaskDTO = try await apiClient.requestData(.post, path: "/api/v1/tasks/\(id)/complete")
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func deleteTask(id: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.delete, path: "/api/v1/tasks/\(id)")
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
