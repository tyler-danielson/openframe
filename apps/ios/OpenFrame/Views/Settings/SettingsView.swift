import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var container: DIContainer
    @State private var showLogoutConfirm = false

    var body: some View {
        let palette = container.themeManager.palette
        List {
            // User profile
            if let user = container.currentUser {
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(palette.primary)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name ?? "User")
                                .font(.headline)
                                .foregroundStyle(palette.foreground)
                            Text(user.email)
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            // Theme
            Section("Appearance") {
                Picker("Theme", selection: Binding(
                    get: { container.themeManager.currentTheme },
                    set: { container.themeManager.currentTheme = $0 }
                )) {
                    ForEach(AppTheme.allCases) { theme in
                        HStack {
                            Circle()
                                .fill(theme.palette.primary)
                                .frame(width: 16, height: 16)
                            Text(theme.displayName)
                        }
                        .tag(theme)
                    }
                }
            }

            // Server info
            Section("Connection") {
                if let url = container.keychainService.serverUrl {
                    HStack {
                        Text("Server")
                        Spacer()
                        Text(url)
                            .font(.caption)
                            .foregroundStyle(palette.mutedForeground)
                    }
                }
                HStack {
                    Text("Auth Method")
                    Spacer()
                    Text(container.keychainService.authMethod == .bearer ? "Token" : "API Key")
                        .font(.caption)
                        .foregroundStyle(palette.mutedForeground)
                }
            }

            // Notifications
            Section("Notifications") {
                Button {
                    container.pushService.requestPermission()
                } label: {
                    HStack {
                        Text("Enable Push Notifications")
                            .foregroundStyle(palette.foreground)
                        Spacer()
                        if container.pushService.isAuthorized {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        }
                    }
                }
            }

            // Join Requests (owner only)
            if container.isOwner {
                Section("Manage") {
                    NavigationLink(destination: JoinRequestsView()) {
                        Label("Companion Invites", systemImage: "person.badge.plus")
                    }
                }
            }

            // App info
            Section("About") {
                HStack {
                    Text("Version")
                    Spacer()
                    Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                        .foregroundStyle(palette.mutedForeground)
                    Text("(\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"))")
                        .foregroundStyle(palette.mutedForeground)
                }
            }

            // Sign out
            Section {
                Button {
                    showLogoutConfirm = true
                } label: {
                    HStack {
                        Spacer()
                        Text("Sign Out")
                            .foregroundStyle(palette.destructive)
                        Spacer()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .alert("Sign Out", isPresented: $showLogoutConfirm) {
            Button("Sign Out", role: .destructive) {
                Task { await container.handleLogout() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }
}
