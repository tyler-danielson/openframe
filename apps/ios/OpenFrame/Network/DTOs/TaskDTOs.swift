import Foundation

struct TaskListDTO: Decodable {
    let id: String
    let name: String
    let isVisible: Bool

    func toDomain() -> TaskList {
        TaskList(id: id, name: name, isVisible: isVisible)
    }
}

struct TaskListInfoDTO: Decodable {
    let id: String
    let name: String
}

struct TaskDTO: Decodable {
    let id: String
    let taskListId: String
    let title: String
    let notes: String?
    let status: String?
    let dueDate: String?
    let completedAt: String?
    let position: Int?
    let list: TaskListInfoDTO?

    func toDomain() -> OFTask {
        OFTask(
            id: id, taskListId: taskListId, title: title, notes: notes,
            status: status, dueDate: dueDate, completedAt: completedAt,
            listName: list?.name
        )
    }
}

struct CreateTaskRequest: Encodable {
    let taskListId: String
    let title: String
    let notes: String?
    let dueDate: String?
}
