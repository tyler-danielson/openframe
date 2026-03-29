import SwiftUI

struct KioskControlView: View {
    @EnvironmentObject private var appState: AppState
    let kioskId: String
    @State private var viewModel: KioskViewModel?
    @State private var showWebpageAlert = false
    @State private var webpageUrl = ""

    var body: some View {
        Group {
            if let vm = viewModel {
                KioskControlContentView(
                    viewModel: vm,
                    appState: appState,
                    showWebpageAlert: $showWebpageAlert
                )
            } else {
                LoadingView()
            }
        }
        .navigationTitle(viewModel?.selectedKiosk?.name ?? "Kiosk")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let vm = KioskViewModel(kioskRepository: appState.kioskRepository)
            viewModel = vm
            await vm.loadKiosk(id: kioskId)
        }
        .alert("Open Webpage", isPresented: $showWebpageAlert) {
            TextField("https://...", text: $webpageUrl)
            Button("Open") {
                guard !webpageUrl.isEmpty else { return }
                Task {
                    await viewModel?.sendCommand(type: "cast", payload: ["url": webpageUrl, "type": "webpage"])
                }
                webpageUrl = ""
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}

private struct KioskControlContentView: View {
    @ObservedObject var viewModel: KioskViewModel
    let appState: AppState
    @Binding var showWebpageAlert: Bool

    var body: some View {
        let palette = appState.themeManager.palette
        ScrollView {
            VStack(spacing: 16) {
                // Kiosk info header
                if let kiosk = viewModel.selectedKiosk {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(kiosk.name).font(Font.title2.bold())
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(kiosk.isActive ? Color.green : palette.mutedForeground)
                                    .frame(width: 8, height: 8)
                                Text(kiosk.isActive ? "Active" : "Inactive")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            if let mode = kiosk.displayType {
                                Text("Display: \(mode)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                    }
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Command status
                if let status = viewModel.commandStatus {
                    Text(status)
                        .font(.subheadline)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(palette.primary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                // Quick actions
                SectionHeader(title: "Quick Actions")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ActionButton(icon: "arrow.clockwise", label: "Refresh", color: palette.primary) {
                        Task { await viewModel.refreshKiosk() }
                    }
                    ActionButton(icon: "arrow.up.left.and.arrow.down.right", label: "Fullscreen", color: palette.primary) {
                        Task { await viewModel.sendCommand(type: "fullscreen") }
                    }
                    ActionButton(icon: "moon.stars", label: "Screensaver", color: palette.primary) {
                        Task { await viewModel.sendCommand(type: "screensaver") }
                    }
                }

                // Cast to screen
                SectionHeader(title: "Cast to Screen")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ActionButton(icon: "globe", label: "Webpage", color: palette.primary) {
                        showWebpageAlert = true
                    }
                    ActionButton(icon: "xmark.circle", label: "Dismiss", color: palette.destructive) {
                        Task { await viewModel.sendCommand(type: "dismiss-overlay") }
                    }
                }

                // Dashboards
                if let kiosk = viewModel.selectedKiosk, !kiosk.dashboards.isEmpty {
                    SectionHeader(title: "Dashboards")
                    ForEach(kiosk.dashboards) { dash in
                        Button {
                            Task {
                                await viewModel.sendCommand(type: "navigate", payload: ["dashboardId": dash.id])
                            }
                        } label: {
                            HStack {
                                Image(systemName: "square.grid.2x2")
                                    .foregroundStyle(palette.primary)
                                Text(dash.name)
                                Spacer()
                                if dash.pinned {
                                    Image(systemName: "pin.fill")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding()
                            .background(Color(.secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Saved files
                if !viewModel.savedFiles.isEmpty {
                    SectionHeader(title: "Saved Files")
                    ForEach(viewModel.savedFiles) { file in
                        HStack {
                            Image(systemName: "doc")
                                .foregroundStyle(palette.primary)
                            VStack(alignment: .leading) {
                                Text(file.name).font(.subheadline)
                                Text(file.fileType).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button {
                                Task { await viewModel.deleteSavedFile(file.id) }
                            } label: {
                                Image(systemName: "trash")
                                    .foregroundStyle(palette.destructive)
                            }
                        }
                        .padding()
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding()
        }
    }
}

private struct SectionHeader: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.headline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
    }
}

private struct ActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}
