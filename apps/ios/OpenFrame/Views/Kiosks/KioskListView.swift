import SwiftUI

struct KioskListView: View {
    @EnvironmentObject var container: DIContainer
    @State private var kiosks: [Kiosk] = []
    @State private var isLoading = true

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if kiosks.isEmpty && !isLoading {
                EmptyStateView(icon: "tv", title: "No Kiosks", message: "No display kiosks are configured")
            } else {
                List(kiosks) { kiosk in
                    NavigationLink(destination: KioskControlView(kioskId: kiosk.id)) {
                        HStack(spacing: 12) {
                            Image(systemName: "tv")
                                .font(.title3)
                                .foregroundStyle(palette.primary)
                                .frame(width: 36, height: 36)
                                .background(palette.primary.opacity(0.1))
                                .cornerRadius(8)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(kiosk.name)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(palette.foreground)

                                HStack(spacing: 4) {
                                    Circle()
                                        .fill(kiosk.isActive == true ? Color.green : Color.gray)
                                        .frame(width: 6, height: 6)
                                    Text(kiosk.isActive == true ? "Online" : "Offline")
                                        .font(.caption)
                                        .foregroundStyle(palette.mutedForeground)
                                }
                            }
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Kiosks")
        .task { await loadKiosks() }
        .refreshable { await loadKiosks() }
    }

    private func loadKiosks() async {
        isLoading = true
        kiosks = (try? await container.kioskRepository.getKiosks()) ?? []
        isLoading = false
    }
}
