import SwiftUI
import AVFoundation

struct QRConnectView: View {
    @EnvironmentObject var container: DIContainer
    @Environment(\.presentationMode) var presentationMode
    @State private var isScanning = true
    @State private var scannedCode: String?
    @State private var error: String?
    @State private var isProcessing = false

    var body: some View {
        let palette = container.themeManager.palette
        ZStack {
            palette.background.ignoresSafeArea()

            if isScanning {
                QRScannerView(
                    onCodeScanned: { code in
                        handleScannedCode(code)
                    },
                    onError: { err in
                        error = err
                        isScanning = false
                    }
                )
                .ignoresSafeArea()

                // Overlay with viewfinder
                VStack {
                    Spacer()
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(palette.primary, lineWidth: 3)
                        .frame(width: 250, height: 250)
                    Spacer()

                    Text("Point camera at QR code")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.black.opacity(0.6))
                        .cornerRadius(10)
                        .padding(.bottom, 60)
                }
            } else {
                VStack(spacing: 20) {
                    if isProcessing {
                        ProgressView()
                            .tint(palette.primary)
                        Text("Connecting...")
                            .foregroundStyle(palette.mutedForeground)
                    } else if let error {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(palette.destructive)
                        Text("Connection Failed")
                            .font(.headline)
                            .foregroundStyle(palette.foreground)
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(palette.mutedForeground)
                            .multilineTextAlignment(.center)

                        Button {
                            self.error = nil
                            isScanning = true
                        } label: {
                            Text("Try Again")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(palette.primary)
                                .foregroundStyle(palette.primaryForeground)
                                .cornerRadius(14)
                        }
                        .padding(.horizontal, 40)
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Scan QR Code")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func handleScannedCode(_ code: String) {
        guard !isProcessing else { return }
        isScanning = false
        isProcessing = true
        HapticService.impact(.medium)

        // Expected format: openframe://connect?server=URL&apiKey=KEY
        guard let url = URL(string: code),
              url.scheme == "openframe",
              url.host == "connect" else {
            error = "Invalid QR code. Expected an OpenFrame connection code."
            isProcessing = false
            return
        }

        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let items = components?.queryItems ?? []
        let server = items.first(where: { $0.name == "server" })?.value
        let apiKey = items.first(where: { $0.name == "apiKey" })?.value

        guard let server, !server.isEmpty else {
            error = "QR code missing server URL."
            isProcessing = false
            return
        }

        Task {
            let ok = await container.authRepository.checkServerHealth(serverUrl: server)
            guard ok else {
                error = "Could not connect to server at \(server)"
                isProcessing = false
                return
            }

            container.keychainService.serverUrl = server

            if let apiKey, !apiKey.isEmpty {
                container.keychainService.saveApiKey(apiKey)
                await container.checkInitialAuth()
            } else {
                await container.loadAuthConfig()
            }

            isProcessing = false
            presentationMode.wrappedValue.dismiss()
        }
    }
}

// MARK: - QR Scanner Camera View

struct QRScannerView: UIViewControllerRepresentable {
    let onCodeScanned: (String) -> Void
    let onError: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCodeScanned: onCodeScanned, onError: onError)
    }

    func makeUIViewController(context: Context) -> UIViewController {
        let vc = UIViewController()
        context.coordinator.setupCamera(in: vc)
        return vc
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        let onCodeScanned: (String) -> Void
        let onError: (String) -> Void
        var captureSession: AVCaptureSession?
        private var hasScanned = false

        init(onCodeScanned: @escaping (String) -> Void, onError: @escaping (String) -> Void) {
            self.onCodeScanned = onCodeScanned
            self.onError = onError
        }

        func setupCamera(in viewController: UIViewController) {
            let session = AVCaptureSession()
            self.captureSession = session

            guard let device = AVCaptureDevice.default(for: .video),
                  let input = try? AVCaptureDeviceInput(device: device) else {
                onError("Camera not available")
                return
            }

            guard session.canAddInput(input) else {
                onError("Cannot access camera input")
                return
            }
            session.addInput(input)

            let output = AVCaptureMetadataOutput()
            guard session.canAddOutput(output) else {
                onError("Cannot process QR codes")
                return
            }
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.qr]

            let previewLayer = AVCaptureVideoPreviewLayer(session: session)
            previewLayer.videoGravity = .resizeAspectFill
            previewLayer.frame = viewController.view.bounds
            viewController.view.layer.addSublayer(previewLayer)

            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
            }
        }

        func metadataOutput(_ output: AVCaptureMetadataOutput,
                          didOutput metadataObjects: [AVMetadataObject],
                          from connection: AVCaptureConnection) {
            guard !hasScanned,
                  let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let value = object.stringValue else { return }

            hasScanned = true
            captureSession?.stopRunning()
            onCodeScanned(value)
        }
    }
}
