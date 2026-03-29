import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var viewModel: SettingsViewModel?
    @State private var showLogoutConfirm = false

    var body: some View {
        Group {
            if let vm = viewModel {
                SettingsContentView(
                    viewModel: vm,
                    appState: appState,
                    showLogoutConfirm: $showLogoutConfirm
                )
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Settings")
        .task {
            let vm = SettingsViewModel(
                authRepository: appState.authRepository,
                calendarRepository: appState.calendarRepository,
                settingsManager: appState.settingsManager
            )
            viewModel = vm
            await vm.load()
        }
        .alert("Log Out", isPresented: $showLogoutConfirm) {
            Button("Log Out", role: .destructive) {
                appState.logout()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to log out?")
        }
    }
}

private struct SettingsContentView: View {
    @ObservedObject var viewModel: SettingsViewModel
    let appState: AppState
    @Binding var showLogoutConfirm: Bool

    var body: some View {
        let palette = appState.themeManager.palette
        ScrollView {
            VStack(spacing: 20) {
                // Profile card
                if let user = viewModel.user {
                    HStack(spacing: 16) {
                        // Avatar circle with initials
                        ZStack {
                            Circle()
                                .fill(palette.primary.opacity(0.2))
                                .frame(width: 56, height: 56)
                            Text(initials(for: user))
                                .font(.title2).bold()
                                .foregroundStyle(palette.primary)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name ?? "User").font(.headline)
                            Text(user.email).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Sync button
                Button {
                    Task { await viewModel.syncAll() }
                } label: {
                    HStack {
                        if viewModel.isSyncing {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                        Text("Sync All Calendars")
                    }
                    .frame(maxWidth: .infinity).padding()
                    .background(palette.secondary)
                    .foregroundStyle(palette.secondaryForeground)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(viewModel.isSyncing)

                // Color scheme picker
                VStack(alignment: .leading, spacing: 12) {
                    Text("Color Scheme")
                        .font(.headline)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 12) {
                        ForEach(AppColorScheme.allCases) { scheme in
                            Button {
                                appState.themeManager.setScheme(scheme)
                            } label: {
                                ZStack {
                                    Circle()
                                        .fill(scheme.accentColor)
                                        .frame(width: 40, height: 40)
                                    if appState.themeManager.currentScheme == scheme {
                                        Circle()
                                            .stroke(.white, lineWidth: 2)
                                            .frame(width: 44, height: 44)
                                        Image(systemName: "checkmark")
                                            .font(.caption).fontWeight(.bold)
                                            .foregroundStyle(.white)
                                    }
                                }
                            }
                        }
                    }
                }

                // Calendar visibility
                if !viewModel.calendars.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Calendars")
                            .font(.headline)

                        ForEach(viewModel.calendars) { calendar in
                            HStack {
                                Toggle(isOn: Binding(
                                    get: { calendar.isVisible },
                                    set: { _ in Task { await viewModel.toggleCalendarVisibility(calendar) } }
                                )) {
                                    VStack(alignment: .leading) {
                                        Text(calendar.effectiveName).font(.subheadline)
                                        if let provider = calendar.provider {
                                            Text(provider).font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                .tint(palette.primary)
                            }
                        }
                    }
                }

                // Logout
                Button {
                    showLogoutConfirm = true
                } label: {
                    HStack {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                        Text("Log Out")
                    }
                    .frame(maxWidth: .infinity).padding()
                    .foregroundStyle(palette.destructive)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(palette.destructive, lineWidth: 1)
                    )
                }
            }
            .padding()
        }
    }

    private func initials(for user: User) -> String {
        let parts = (user.name ?? user.email).split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String((user.name ?? user.email).prefix(2)).uppercased()
    }
}
