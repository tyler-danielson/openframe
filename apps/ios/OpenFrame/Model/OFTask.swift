import Foundation

struct TaskList: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let name: String
    let isVisible: Bool
}

struct OFTask: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let taskListId: String
    let title: String
    let notes: String?
    let status: String?
    let dueDate: String?
    let completedAt: String?
    let listName: String?

    var isCompleted: Bool {
        status == "completed"
    }
}
