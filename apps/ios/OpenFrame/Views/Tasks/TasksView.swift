import SwiftUI

struct TasksView: View {
    @EnvironmentObject var container: DIContainer
    @State private var taskLists: [TaskList] = []
    @State private var tasks: [OFTask] = []
    @State private var isLoading = true
    @State private var showNewTask = false
    @State private var newTaskTitle = ""
    @State private var selectedListId: String?

    var body: some View {
        let palette = container.themeManager.palette
        List {
            // Overdue
            if !overdueTasks.isEmpty {
                Section("Overdue") {
                    ForEach(overdueTasks) { task in
                        TaskRow(task: task) { toggleTask(task) }
                    }
                    .onDelete { indexSet in deleteTasks(from: overdueTasks, at: indexSet) }
                }
            }

            // Today
            if !todayTasks.isEmpty {
                Section("Today") {
                    ForEach(todayTasks) { task in
                        TaskRow(task: task) { toggleTask(task) }
                    }
                    .onDelete { indexSet in deleteTasks(from: todayTasks, at: indexSet) }
                }
            }

            // Upcoming (no due date or future)
            if !upcomingTasks.isEmpty {
                Section("Upcoming") {
                    ForEach(upcomingTasks) { task in
                        TaskRow(task: task) { toggleTask(task) }
                    }
                    .onDelete { indexSet in deleteTasks(from: upcomingTasks, at: indexSet) }
                }
            }

            // Completed
            if !completedTasks.isEmpty {
                Section("Completed") {
                    ForEach(completedTasks) { task in
                        TaskRow(task: task) { toggleTask(task) }
                    }
                    .onDelete { indexSet in deleteTasks(from: completedTasks, at: indexSet) }
                }
            }

            if tasks.isEmpty && !isLoading {
                EmptyStateView(
                    icon: "checklist",
                    title: "No Tasks",
                    message: "Add a task to get started"
                )
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Tasks")
        .toolbar {
            if container.canEditTasks {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showNewTask = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .alert("New Task", isPresented: $showNewTask) {
            TextField("Task title", text: $newTaskTitle)
            Button("Add") { createTask() }
            Button("Cancel", role: .cancel) { newTaskTitle = "" }
        }
        .task { await loadData() }
        .refreshable { await loadData() }
    }

    // MARK: - Task Grouping

    private var activeTasks: [OFTask] { tasks.filter { !$0.isCompleted } }
    private var completedTasks: [OFTask] { tasks.filter { $0.isCompleted } }

    private var overdueTasks: [OFTask] {
        activeTasks.filter { task in
            guard let due = task.dueDateParsed else { return false }
            return due.isPast && !due.isToday
        }
    }

    private var todayTasks: [OFTask] {
        activeTasks.filter { task in
            guard let due = task.dueDateParsed else { return false }
            return due.isToday
        }
    }

    private var upcomingTasks: [OFTask] {
        activeTasks.filter { task in
            guard let due = task.dueDateParsed else { return true }
            return !due.isPast || due.isToday ? false : true
        }
        + activeTasks.filter { $0.dueDate == nil }
    }

    // MARK: - Actions

    private func loadData() async {
        isLoading = true
        taskLists = (try? await container.taskRepository.getTaskLists()) ?? []
        selectedListId = taskLists.first?.id
        tasks = (try? await container.taskRepository.getTasks()) ?? []
        isLoading = false
    }

    private func toggleTask(_ task: OFTask) {
        Task {
            let newStatus = task.isCompleted ? "needsAction" : "completed"
            try? await container.taskRepository.updateTask(id: task.id, updates: ["status": newStatus])
            HapticService.notification(task.isCompleted ? .warning : .success)
            await loadData()
        }
    }

    private func createTask() {
        guard !newTaskTitle.isEmpty, let listId = selectedListId else { return }
        let title = newTaskTitle
        newTaskTitle = ""
        Task {
            try? await container.taskRepository.createTask(taskListId: listId, title: title)
            await loadData()
        }
    }

    private func deleteTasks(from source: [OFTask], at indexSet: IndexSet) {
        for index in indexSet {
            let task = source[index]
            Task { try? await container.taskRepository.deleteTask(id: task.id) }
        }
        tasks.removeAll { task in indexSet.map { source[$0].id }.contains(task.id) }
    }
}
