import SwiftUI

struct TasksView: View {
    @EnvironmentObject private var appState: AppState
    @State private var viewModel: TasksViewModel?
    @State private var showAddSheet = false
    @State private var newTaskTitle = ""

    var body: some View {
        Group {
            if let vm = viewModel {
                TasksContentView(viewModel: vm, appState: appState, showAddSheet: $showAddSheet)
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

    private var addTaskSheet: some View {
        NavigationView {
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
    }
}

private struct TasksContentView: View {
    @ObservedObject var viewModel: TasksViewModel
    let appState: AppState
    @Binding var showAddSheet: Bool

    var body: some View {
        let palette = appState.themeManager.palette
        VStack(spacing: 0) {
            // Task list chips
            if !viewModel.taskLists.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.taskLists) { list in
                            Button {
                                viewModel.selectList(list.id)
                            } label: {
                                Text(list.name)
                                    .font(.subheadline)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(viewModel.selectedListId == list.id ? palette.primary.opacity(0.15) : palette.muted)
                                    .foregroundStyle(viewModel.selectedListId == list.id ? palette.primary : palette.mutedForeground)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
            }

            if viewModel.isLoading && viewModel.tasks.isEmpty {
                LoadingView()
            } else if viewModel.filteredTasks.isEmpty {
                EmptyStateView(icon: "checklist", title: "No tasks", subtitle: "Tap + to add a task")
            } else {
                List {
                    ForEach(viewModel.filteredTasks) { task in
                        TaskRow(task: task) {
                            Task { await viewModel.completeTask(task.id) }
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await viewModel.deleteTask(task.id) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    if let id = viewModel.selectedListId {
                        await viewModel.loadTasks(listId: id)
                    }
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if viewModel.selectedListId != nil {
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
}
