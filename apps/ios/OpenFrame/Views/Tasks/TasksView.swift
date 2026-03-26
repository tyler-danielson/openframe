import SwiftUI

struct TasksView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: TasksViewModel?
    @State private var showAddSheet = false
    @State private var newTaskTitle = ""

    var body: some View {
        Group {
            if let vm = viewModel {
                tasksContent(vm)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Tasks")
        .toolbar {
            if let vm = viewModel {
                ToolbarItem(placement: .primaryAction) {
                    Button(vm.showCompleted ? "Hide Done" : "Show Done") {
                        vm.showCompleted.toggle()
                    }
                    .font(.subheadline)
                }
            }
        }
        .task {
            let vm = TasksViewModel(taskRepository: appState.taskRepository, settingsManager: appState.settingsManager)
            viewModel = vm
            await vm.loadTaskLists()
        }
        .sheet(isPresented: $showAddSheet) {
            addTaskSheet
        }
    }

    @ViewBuilder
    private func tasksContent(_ vm: TasksViewModel) -> some View {
        let palette = appState.themeManager.palette
        VStack(spacing: 0) {
            // Task list chips
            if !vm.taskLists.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(vm.taskLists) { list in
                            Button {
                                vm.selectList(list.id)
                            } label: {
                                Text(list.name)
                                    .font(.subheadline)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(vm.selectedListId == list.id ? palette.primary.opacity(0.15) : palette.muted)
                                    .foregroundStyle(vm.selectedListId == list.id ? palette.primary : palette.mutedForeground)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
            }

            if vm.isLoading && vm.tasks.isEmpty {
                LoadingView()
            } else if vm.filteredTasks.isEmpty {
                EmptyStateView(icon: "checklist", title: "No tasks", subtitle: "Tap + to add a task")
            } else {
                List {
                    ForEach(vm.filteredTasks) { task in
                        TaskRow(task: task) {
                            Task { await vm.completeTask(task.id) }
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await vm.deleteTask(task.id) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    if let id = vm.selectedListId {
                        await vm.loadTasks(listId: id)
                    }
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if vm.selectedListId != nil {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .font(.title2)
                        .foregroundStyle(palette.primaryForeground)
                        .frame(width: 56, height: 56)
                        .background(palette.primary)
                        .clipShape(Circle())
                        .shadow(radius: 4)
                }
                .padding(20)
            }
        }
    }

    private var addTaskSheet: some View {
        NavigationStack {
            VStack(spacing: 16) {
                TextField("Task title", text: $newTaskTitle)
                    .textFieldStyle(.roundedBorder)
                Spacer()
            }
            .padding()
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showAddSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard !newTaskTitle.isEmpty, let vm = viewModel else { return }
                        Task { await vm.createTask(title: newTaskTitle) }
                        newTaskTitle = ""
                        showAddSheet = false
                    }
                    .disabled(newTaskTitle.isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
