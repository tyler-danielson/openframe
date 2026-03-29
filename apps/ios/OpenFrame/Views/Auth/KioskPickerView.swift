import SwiftUI

struct KioskPickerView: View {
    @ObservedObject var viewModel: AuthViewModel
    let user: User

    private var palette: ThemePalette { viewModel.appState.themeManager.palette }

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Text("Welcome, \(user.name ?? "there")!")
                    .font(.title2).bold()

                Text("Select a kiosk to manage")
                    .foregroundStyle(.secondary)

                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.kiosks) { kiosk in
                            KioskPickerCard(kiosk: kiosk, palette: palette) {
                                viewModel.skipKioskPicker()
                            }
                        }
                    }
                }

                Button {
                    viewModel.skipKioskPicker()
                } label: {
                    Text("Skip")
                        .frame(maxWidth: .infinity).padding()
                        .background(palette.primary)
                        .foregroundStyle(palette.primaryForeground)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(24)
        }
    }
}

private struct KioskPickerCard: View {
    let kiosk: Kiosk
    let palette: ThemePalette
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
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
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if let lastAccessed = kiosk.lastAccessedAt {
                            Text("- \(lastAccessed.toRelativeTime())")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text("\(kiosk.dashboards.count) dashboards")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding()
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
