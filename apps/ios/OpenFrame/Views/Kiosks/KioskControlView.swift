import SwiftUI

struct KioskControlView: View {
    let kioskId: String
    @EnvironmentObject var container: DIContainer
    @State private var kiosk: Kiosk?
    @State private var files: [KioskSavedFile] = []
    @State private var commandStatus: String?
    @State private var isLoading = true
    @State private var showCastURL = false
    @State private var castURLText = ""

    var body: some View {
        let palette = container.themeManager.palette
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let kiosk {
                    // Status header
                    HStack(spacing: 12) {
                        Image(systemName: "tv")
                            .font(.title)
                            .foregroundStyle(palette.primary)
                            .frame(width: 48, height: 48)
                            .background(palette.primary.opacity(0.1))
                            .cornerRadius(12)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(kiosk.name)
                                .font(.title3.bold())
                                .foregroundStyle(palette.foreground)
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(kiosk.isActive == true ? Color.green : Color.gray)
                                    .frame(width: 8, height: 8)
                                Text(kiosk.isActive == true ? "Online" : "Offline")
                                    .font(.subheadline)
                                    .foregroundStyle(palette.mutedForeground)
                            }
                        }
                        Spacer()
                    }

                    // Command status
                    if let status = commandStatus {
                        Text(status)
                            .font(.caption)
                            .foregroundStyle(palette.primary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(palette.primary.opacity(0.1))
                            .cornerRadius(8)
                    }

                    // Quick actions
                    SectionLabel(title: "Quick Actions", palette: palette)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        KioskActionButton(icon: "arrow.clockwise", title: "Refresh", palette: palette) {
                            await sendCommand("refresh")
                        }
                        KioskActionButton(icon: "arrow.up.left.and.arrow.down.right", title: "Fullscreen", palette: palette) {
                            await sendCommand("fullscreen")
                        }
                        KioskActionButton(icon: "moon.stars", title: "Screensaver", palette: palette) {
                            await sendCommand("screensaver")
                        }
                    }

                    // Cast
                    SectionLabel(title: "Cast to Screen", palette: palette)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        KioskActionButton(icon: "globe", title: "Webpage", palette: palette) {
                            showCastURL = true
                        }
                        KioskActionButton(icon: "xmark.circle", title: "Dismiss", palette: palette) {
                            await sendCommand("dismiss-overlay")
                        }
                    }

                    // Dashboards
                    if let dashboards = kiosk.dashboards, !dashboards.isEmpty {
                        SectionLabel(title: "Dashboards", palette: palette)
                        ForEach(dashboards) { dashboard in
                            Button {
                                Task {
                                    await sendCommand("navigate", payload: ["dashboardId": dashboard.id])
                                }
                            } label: {
                                HStack {
                                    Image(systemName: iconForDashboard(dashboard.type))
                                        .foregroundStyle(palette.primary)
                                    Text(dashboard.name ?? dashboard.type ?? "Dashboard")
                                        .foregroundStyle(palette.foreground)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundStyle(palette.mutedForeground)
                                }
                                .padding()
                                .background(palette.secondary)
                                .cornerRadius(10)
                            }
                        }
                    }

                    // Saved files
                    if !files.isEmpty {
                        SectionLabel(title: "Saved Files", palette: palette)
                        ForEach(files) { file in
                            HStack {
                                Image(systemName: "doc")
                                    .foregroundStyle(palette.mutedForeground)
                                Text(file.name ?? "Untitled")
                                    .font(.subheadline)
                                    .foregroundStyle(palette.foreground)
                                Spacer()
                                Button {
                                    deleteFile(file)
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.caption)
                                        .foregroundStyle(palette.destructive)
                                }
                            }
                            .padding()
                            .background(palette.secondary)
                            .cornerRadius(10)
                        }
                    }
                } else if isLoading {
                    LoadingView()
                }
            }
            .padding()
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle(kiosk?.name ?? "Kiosk")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Cast Webpage", isPresented: $showCastURL) {
            TextField("https://example.com", text: $castURLText)
            Button("Cast") {
                Task { await sendCommand("cast", payload: ["url": castURLText]) }
                castURLText = ""
            }
            Button("Cancel", role: .cancel) { castURLText = "" }
        }
        .task { await loadKiosk() }
        .refreshable { await loadKiosk() }
    }

    private func loadKiosk() async {
        isLoading = true
        kiosk = try? await container.kioskRepository.getKiosk(id: kioskId)
        files = (try? await container.kioskRepository.getFiles(kioskId: kioskId)) ?? []
        isLoading = false
    }

    private func sendCommand(_ type: String, payload: [String: String]? = nil) async {
        commandStatus = "Sending..."
        do {
            try await container.kioskRepository.sendCommand(kioskId: kioskId, type: type, payload: payload)
            commandStatus = "Command sent"
            HapticService.notification(.success)
        } catch {
            commandStatus = "Error: \(error.localizedDescription)"
            HapticService.notification(.error)
        }
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        commandStatus = nil
    }

    private func deleteFile(_ file: KioskSavedFile) {
        Task {
            try? await container.kioskRepository.deleteFile(kioskId: kioskId, fileId: file.id)
            files.removeAll { $0.id == file.id }
        }
    }

    private func iconForDashboard(_ type: String?) -> String {
        switch type {
        case "calendar": return "calendar"
        case "tasks": return "checklist"
        case "photos": return "photo"
        case "spotify": return "music.note"
        case "iptv": return "play.tv"
        case "cameras": return "video"
        case "homeassistant": return "bolt.fill"
        case "screensaver": return "moon.stars"
        default: return "square.grid.2x2"
        }
    }
}

private struct SectionLabel: View {
    let title: String
    let palette: ThemePalette

    var body: some View {
        Text(title)
            .font(.headline)
            .foregroundStyle(palette.foreground)
            .padding(.top, 4)
    }
}

private struct KioskActionButton: View {
    let icon: String
    let title: String
    let palette: ThemePalette
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(palette.primary)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(palette.foreground)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(palette.secondary)
            .cornerRadius(12)
        }
    }
}
