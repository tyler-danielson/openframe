import Foundation

final class TasksViewModel: ObservableObject {
    @Published var taskLists: [TaskList] = []
    @Published var selectedListId: String?
    @Published var tasks: [OFTask] = []
    @Published var showCompleted = false
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let taskRepository: TaskRepository
    private let settingsManager: SettingsManager

    init(taskRepository: TaskRepository, settingsManager: SettingsManager) {
        self.taskRepository = taskRepository
        self.settingsManager = settingsManager
    }

    var filteredTasks: [OFTask] {
        if showCompleted { return tasks }
        return tasks.filter { !$0.isCompleted }
    }

    func loadTaskLists() async {
        isLoading = true
        let result = await taskRepository.getTaskLists()
        switch result {
        case .success(let lists):
            taskLists = lists
            // Restore or auto-select
            if let saved = settingsManager.selectedTaskListId, lists.contains(where: { $0.id == saved }) {
                selectedListId = saved
            } else {
                selectedListId = lists.first?.id
            }
            if let id = selectedListId {
                await loadTasks(listId: id)
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func selectList(_ id: String) {
        selectedListId = id
        settingsManager.selectedTaskListId = id
        Task { await loadTasks(listId: id) }
    }

    func loadTasks(listId: String) async {
        let result = await taskRepository.getTasks(listId: listId)
        if case .success(let loaded) = result {
            tasks = loaded
        }
    }

    func createTask(title: String) async {
        guard let listId = selectedListId else { return }
        let result = await taskRepository.createTask(taskListId: listId, title: title)
        if case .success(let task) = result {
            tasks.insert(task, at: 0)
        }
    }

    func completeTask(_ id: String) async {
        let result = await taskRepository.completeTask(id: id)
        if case .success(let updated) = result {
            if let idx = tasks.firstIndex(where: { $0.id == id }) {
                tasks[idx] = updated
            }
        }
    }

    func deleteTask(_ id: String) async {
        let result = await taskRepository.deleteTask(id: id)
        if case .success = result {
            tasks.removeAll { $0.id == id }
        }
    }
}
