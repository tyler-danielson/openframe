import Foundation

struct TaskList: Identifiable, Codable {
    let id: String
    let name: String
    var isDefault: Bool?
}

struct OFTask: Identifiable, Codable {
    let id: String
    let taskListId: String
    var title: String
    var notes: String?
    var status: String  // "needsAction" or "completed"
    var dueDate: String?
    var createdAt: String?
    var updatedAt: String?

    var isCompleted: Bool { status == "completed" }

    var dueDateParsed: Date? {
        guard let dueDate else { return nil }
        return ISO8601DateFormatter().date(from: dueDate)
    }
}
