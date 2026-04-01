import Foundation
import Combine

/// Lightweight WebSocket client for real-time kiosk/event updates.
final class WebSocketClient: ObservableObject {
    enum ConnectionState {
        case disconnected, connecting, connected
    }

    @Published var state: ConnectionState = .disconnected
    @Published var lastMessage: String?

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession
    private var pingTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var serverUrl: String?
    private var keychainService: KeychainService?

    init() {
        self.session = URLSession(configuration: .default)
    }

    func configure(keychainService: KeychainService) {
        self.keychainService = keychainService
    }

    // MARK: - Connect

    func connect() {
        guard let keychainService,
              let baseUrl = keychainService.serverUrl else { return }

        let wsScheme = baseUrl.hasPrefix("https") ? "wss" : "ws"
        let host = baseUrl
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        guard let url = URL(string: "\(wsScheme)://\(host)/api/v1/ws") else { return }

        var request = URLRequest(url: url)
        if keychainService.authMethod == .bearer, let token = keychainService.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else if keychainService.authMethod == .apiKey, let key = keychainService.apiKey {
            request.setValue(key, forHTTPHeaderField: "X-API-Key")
        }

        state = .connecting
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()
        state = .connected
        reconnectAttempts = 0
        startPing()
        receiveMessage()
    }

    // MARK: - Disconnect

    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        state = .disconnected
        reconnectAttempts = 0
    }

    // MARK: - Send

    func send(_ message: String) {
        webSocketTask?.send(.string(message)) { error in
            if let error {
                print("[WebSocket] Send error: \(error)")
            }
        }
    }

    func send<T: Encodable>(_ payload: T) {
        guard let data = try? JSONEncoder().encode(payload),
              let string = String(data: data, encoding: .utf8) else { return }
        send(string)
    }

    // MARK: - Private

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    DispatchQueue.main.async {
                        self.lastMessage = text
                    }
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        DispatchQueue.main.async {
                            self.lastMessage = text
                        }
                    }
                @unknown default:
                    break
                }
                self.receiveMessage()

            case .failure(let error):
                print("[WebSocket] Receive error: \(error)")
                DispatchQueue.main.async {
                    self.state = .disconnected
                    self.attemptReconnect()
                }
            }
        }
    }

    private func startPing() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.webSocketTask?.sendPing { error in
                if let error {
                    print("[WebSocket] Ping error: \(error)")
                }
            }
        }
    }

    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("[WebSocket] Max reconnect attempts reached")
            return
        }
        reconnectAttempts += 1
        let delay = Double(min(reconnectAttempts * 2, 30))
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.connect()
        }
    }
}
