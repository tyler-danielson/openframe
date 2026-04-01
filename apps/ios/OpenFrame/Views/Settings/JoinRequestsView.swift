import SwiftUI

struct JoinRequestsView: View {
    @EnvironmentObject var container: DIContainer
    @State private var invites: [CompanionInvite] = []
    @State private var isLoading = true
    @State private var showCreateInvite = false
    @State private var newInviteLabel = ""

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if invites.isEmpty && !isLoading {
                EmptyStateView(
                    icon: "person.badge.plus",
                    title: "No Invites",
                    message: "Create an invite link to share with family members",
                    actionTitle: "Create Invite",
                    action: { showCreateInvite = true }
                )
            } else {
                List {
                    ForEach(invites) { invite in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(invite.label ?? "Unnamed Invite")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(palette.foreground)

                            if let token = invite.token {
                                Text("Token: \(token.prefix(8))...")
                                    .font(.caption)
                                    .foregroundStyle(palette.mutedForeground)
                            }

                            if let expires = invite.expiresAt, let date = Date.fromISO(expires) {
                                Text("Expires: \(date.shortDateString)")
                                    .font(.caption)
                                    .foregroundStyle(palette.mutedForeground)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let invite = invites[index]
                            Task { try? await container.companionRepository.deleteInvite(id: invite.id) }
                        }
                        invites.remove(atOffsets: indexSet)
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Companion Invites")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showCreateInvite = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .alert("Create Invite", isPresented: $showCreateInvite) {
            TextField("Label (optional)", text: $newInviteLabel)
            Button("Create") { createInvite() }
            Button("Cancel", role: .cancel) { newInviteLabel = "" }
        }
        .task { await loadInvites() }
        .refreshable { await loadInvites() }
    }

    private func loadInvites() async {
        isLoading = true
        invites = (try? await container.companionRepository.getInvites()) ?? []
        isLoading = false
    }

    private func createInvite() {
        let label = newInviteLabel.isEmpty ? nil : newInviteLabel
        newInviteLabel = ""
        Task {
            if let invite = try? await container.companionRepository.createInvite(label: label) {
                invites.insert(invite, at: 0)
            }
        }
    }
}
