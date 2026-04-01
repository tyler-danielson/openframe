import SwiftUI

struct HAEntitiesView: View {
    @EnvironmentObject var container: DIContainer
    @State private var entities: [HAEntity] = []
    @State private var rooms: [HARoom] = []
    @State private var isLoading = true

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if entities.isEmpty && !isLoading {
                EmptyStateView(icon: "bolt.fill", title: "No Entities", message: "Home Assistant is not configured or has no entities")
            } else {
                List {
                    ForEach(groupedEntities.keys.sorted(), id: \.self) { domain in
                        Section(domain.capitalized) {
                            ForEach(groupedEntities[domain] ?? []) { entity in
                                HAEntityRow(entity: entity) {
                                    toggleEntity(entity)
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Home Assistant")
        .task { await loadData() }
        .refreshable { await loadData() }
    }

    private var groupedEntities: [String: [HAEntity]] {
        Dictionary(grouping: entities) { entity in
            entity.domain ?? String(entity.entityId.prefix(while: { $0 != "." }))
        }
    }

    private func loadData() async {
        isLoading = true
        async let entitiesResult = container.haRepository.getEntities()
        async let roomsResult = container.haRepository.getRooms()
        entities = (try? await entitiesResult) ?? []
        rooms = (try? await roomsResult) ?? []
        isLoading = false
    }

    private func toggleEntity(_ entity: HAEntity) {
        Task {
            try? await container.haRepository.toggleEntity(entityId: entity.entityId)
            HapticService.impact(.medium)
        }
    }
}

private struct HAEntityRow: View {
    let entity: HAEntity
    var onToggle: (() -> Void)?
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        let domain = entity.domain ?? String(entity.entityId.prefix(while: { $0 != "." }))
        let isToggleable = ["switch", "light", "input_boolean", "fan", "automation"].contains(domain)

        HStack {
            Image(systemName: iconForDomain(domain))
                .foregroundStyle(palette.primary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(entity.displayName ?? entity.entityId)
                    .font(.subheadline)
                    .foregroundStyle(palette.foreground)
                Text(entity.entityId)
                    .font(.caption2)
                    .foregroundStyle(palette.mutedForeground)
            }

            Spacer()

            if isToggleable {
                Button {
                    onToggle?()
                } label: {
                    Image(systemName: "power")
                        .foregroundStyle(palette.primary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func iconForDomain(_ domain: String) -> String {
        switch domain {
        case "light": return "lightbulb"
        case "switch": return "toggle.power"
        case "fan": return "fanblades"
        case "sensor": return "gauge"
        case "binary_sensor": return "sensor.tag.radiowaves.forward"
        case "climate": return "thermometer"
        case "camera": return "video"
        case "automation": return "gearshape.2"
        case "input_boolean": return "togglepower"
        default: return "bolt"
        }
    }
}
