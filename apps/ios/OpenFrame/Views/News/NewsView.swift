import SwiftUI
import SafariServices
import Kingfisher

struct NewsView: View {
    @EnvironmentObject var container: DIContainer
    @State private var headlines: [NewsHeadline] = []
    @State private var isLoading = true
    @State private var selectedURL: URL?

    var body: some View {
        let palette = container.themeManager.palette
        Group {
            if headlines.isEmpty && !isLoading {
                EmptyStateView(icon: "newspaper", title: "No News", message: "News sources are not configured")
            } else {
                List(headlines) { headline in
                    Button {
                        if let link = headline.link ?? headline.url, let url = URL(string: link) {
                            selectedURL = url
                        }
                    } label: {
                        HStack(spacing: 12) {
                            if let imageUrl = headline.imageUrl, let url = URL(string: imageUrl) {
                                KFImage(url)
                                    .resizable()
                                    .placeholder { palette.secondary }
                                    .frame(width: 60, height: 60)
                                    .cornerRadius(8)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(headline.title)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(palette.foreground)
                                    .lineLimit(3)

                                HStack(spacing: 8) {
                                    if let source = headline.source {
                                        Text(source)
                                            .font(.caption)
                                            .foregroundStyle(palette.primary)
                                    }
                                    if let pubDate = headline.publishedAt, let date = Date.fromISO(pubDate) {
                                        Text(date.relativeString)
                                            .font(.caption)
                                            .foregroundStyle(palette.mutedForeground)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.plain)
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("News")
        .sheet(item: $selectedURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
        }
        .task { await loadHeadlines() }
        .refreshable { await loadHeadlines() }
    }

    private func loadHeadlines() async {
        isLoading = true
        headlines = (try? await container.newsRepository.getHeadlines(limit: 30)) ?? []
        isLoading = false
    }
}

// Make URL identifiable for sheet
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

// Safari view wrapper
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
