import SwiftUI

struct KioskListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var viewModel: KioskViewModel?

    var onNavigateToKiosk: (String) -> Void

    var body: some View {
        Group {
            if let vm = viewModel {
                KioskListContentView(viewModel: vm, appState: appState, onNavigateToKiosk: onNavigateToKiosk)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Kiosks")
        .task {
            let vm = KioskViewModel(kioskRepository: appState.kioskRepository)
            viewModel = vm
            await vm.loadKiosks()
        }
    }
}

private struct KioskListContentView: View {
    @ObservedObject var viewModel: KioskViewModel
    let appState: AppState
    var onNavigateToKiosk: (String) -> Void

    var body: some View {
        let palette = appState.themeManager.palette
        if viewModel.isLoading && viewModel.kiosks.isEmpty {
            LoadingView()
        } else if viewModel.kiosks.isEmpty {
            EmptyStateView(icon: "tv", title: "No kiosks")
        } else {
            List {
                ForEach(viewModel.kiosks) { kiosk in
                    Button { onNavigateToKiosk(kiosk.id) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "tv")
                                .font(.title2)
                                .foregroundStyle(palette.primary)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(kiosk.name).font(.headline)
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(kiosk.isActive ? Color.green : palette.mutedForeground)
                                        .frame(width: 8, height: 8)
                                    Text(kiosk.isActive ? "Active" : "Inactive")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                if let lastAccessed = kiosk.lastAccessedAt {
                                    Text("Last seen: \(lastAccessed.toRelativeTime())")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                            }

                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.plain)
            .refreshable { await viewModel.loadKiosks() }
        }
    }
}
