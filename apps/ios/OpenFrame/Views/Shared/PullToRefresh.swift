import SwiftUI
import UIKit

/// A pull-to-refresh wrapper for ScrollView on iOS 15.
/// Usage: PullToRefreshScrollView(onRefresh: { await loadData() }) { content }
struct PullToRefreshScrollView<Content: View>: View {
    let onRefresh: () async -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        if #available(iOS 16.0, *) {
            ScrollView {
                content()
            }
            .refreshable { await onRefresh() }
        } else {
            LegacyRefreshableScrollView(onRefresh: onRefresh, content: content)
        }
    }
}

// MARK: - iOS 15 Legacy Implementation

private struct LegacyRefreshableScrollView<Content: View>: UIViewRepresentable {
    let onRefresh: () async -> Void
    @ViewBuilder let content: () -> Content

    func makeCoordinator() -> Coordinator {
        Coordinator(onRefresh: onRefresh)
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = true

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.handleRefresh(_:)),
            for: .valueChanged
        )
        scrollView.refreshControl = refreshControl

        let hostingController = UIHostingController(rootView: content())
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        hostingController.view.backgroundColor = .clear
        scrollView.addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            hostingController.view.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor)
        ])

        context.coordinator.hostingController = hostingController
        return scrollView
    }

    func updateUIView(_ scrollView: UIScrollView, context: Context) {
        context.coordinator.hostingController?.rootView = content()
    }

    class Coordinator {
        let onRefresh: () async -> Void
        var hostingController: UIHostingController<Content>?

        init(onRefresh: @escaping () async -> Void) {
            self.onRefresh = onRefresh
        }

        @objc func handleRefresh(_ control: UIRefreshControl) {
            Task { @MainActor in
                await onRefresh()
                control.endRefreshing()
            }
        }
    }
}
