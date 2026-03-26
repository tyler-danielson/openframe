import Foundation

@Observable
final class KioskViewModel {
    var kiosks: [Kiosk] = []
    var selectedKiosk: Kiosk?
    var savedFiles: [KioskSavedFile] = []
    var isLoading = false
    var errorMessage: String?
    var commandStatus: String?

    private let kioskRepository: KioskRepository

    init(kioskRepository: KioskRepository) {
        self.kioskRepository = kioskRepository
    }

    func loadKiosks() async {
        isLoading = true
        let result = await kioskRepository.getKiosks()
        switch result {
        case .success(let loaded):
            kiosks = loaded
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadKiosk(id: String) async {
        isLoading = true
        let result = await kioskRepository.getKiosk(id: id)
        switch result {
        case .success(let kiosk):
            selectedKiosk = kiosk
        case .failure(let error):
            errorMessage = error.localizedDescription
        }

        // Also load saved files
        let filesResult = await kioskRepository.getSavedFiles(kioskId: id)
        if case .success(let files) = filesResult {
            savedFiles = files
        }
        isLoading = false
    }

    func sendCommand(type: String, payload: [String: String]? = nil) async {
        guard let kioskId = selectedKiosk?.id else { return }
        commandStatus = "Sending..."
        let result = await kioskRepository.sendCommand(kioskId: kioskId, type: type, payload: payload)
        switch result {
        case .success:
            commandStatus = "Command sent"
        case .failure(let error):
            commandStatus = "Failed: \(error.localizedDescription)"
        }

        // Auto-dismiss status after 2 seconds
        try? await Task.sleep(for: .seconds(2))
        commandStatus = nil
    }

    func refreshKiosk() async {
        guard let kioskId = selectedKiosk?.id else { return }
        let result = await kioskRepository.refreshKiosk(id: kioskId)
        if case .success = result {
            commandStatus = "Refresh sent"
            try? await Task.sleep(for: .seconds(2))
            commandStatus = nil
        }
    }

    func deleteSavedFile(_ fileId: String) async {
        guard let kioskId = selectedKiosk?.id else { return }
        let result = await kioskRepository.deleteSavedFile(kioskId: kioskId, fileId: fileId)
        if case .success = result {
            savedFiles.removeAll { $0.id == fileId }
        }
    }
}
