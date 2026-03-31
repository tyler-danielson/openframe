package us.openframe.app.ui.kiosk

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import us.openframe.app.data.local.TokenManager
import us.openframe.app.data.remote.api.FileShareApi
import us.openframe.app.data.remote.api.KioskApi
import us.openframe.app.data.remote.dto.KioskSavedFileDto
import us.openframe.app.data.repository.KioskRepository
import us.openframe.app.domain.model.Kiosk
import javax.inject.Inject

sealed interface KioskUiState {
    data object Loading : KioskUiState
    data class Success(val kiosks: List<Kiosk>) : KioskUiState
    data class Error(val message: String) : KioskUiState
}

sealed interface KioskDetailUiState {
    data object Loading : KioskDetailUiState
    data class Success(val kiosk: Kiosk) : KioskDetailUiState
    data class Error(val message: String) : KioskDetailUiState
}

@HiltViewModel
class KioskViewModel @Inject constructor(
    private val kioskRepository: KioskRepository,
    private val kioskApi: KioskApi,
    private val fileShareApi: FileShareApi,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow<KioskUiState>(KioskUiState.Loading)
    val uiState: StateFlow<KioskUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow<KioskDetailUiState>(KioskDetailUiState.Loading)
    val detailState: StateFlow<KioskDetailUiState> = _detailState.asStateFlow()

    private val _commandStatus = MutableStateFlow<String?>(null)
    val commandStatus: StateFlow<String?> = _commandStatus.asStateFlow()

    private val _savedFiles = MutableStateFlow<List<KioskSavedFileDto>>(emptyList())
    val savedFiles: StateFlow<List<KioskSavedFileDto>> = _savedFiles.asStateFlow()

    private val _currentPdfPages = MutableStateFlow<Int?>(null)
    val currentPdfPages: StateFlow<Int?> = _currentPdfPages.asStateFlow()

    private val _currentPage = MutableStateFlow(1)
    val currentPage: StateFlow<Int> = _currentPage.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = KioskUiState.Loading
            kioskRepository.getKiosks().fold(
                onSuccess = { _uiState.value = KioskUiState.Success(it) },
                onFailure = { _uiState.value = KioskUiState.Error(it.message ?: "Failed") },
            )
        }
    }

    fun loadKiosk(id: String) {
        viewModelScope.launch {
            _detailState.value = KioskDetailUiState.Loading
            kioskRepository.getKiosk(id).fold(
                onSuccess = { _detailState.value = KioskDetailUiState.Success(it) },
                onFailure = { _detailState.value = KioskDetailUiState.Error(it.message ?: "Failed") },
            )
            loadSavedFiles(id)
        }
    }

    fun sendCommand(kioskId: String, command: String, payload: Map<String, Any>? = null) {
        viewModelScope.launch {
            kioskRepository.sendCommand(kioskId, command, payload).fold(
                onSuccess = { showStatus("Sent: $command") },
                onFailure = { showStatus("Failed: ${it.message}") },
            )
        }
    }

    fun sendWidgetCommand(
        kioskId: String,
        widgetType: String,
        action: String,
        data: Map<String, Any>? = null,
    ) {
        val payload = buildMap<String, Any> {
            put("widgetType", widgetType)
            put("action", action)
            if (data != null) put("data", data)
        }
        sendCommand(kioskId, "widget-control", payload)
    }

    // ═══ File Upload + Cast ═══

    fun uploadAndCastFile(kioskId: String, uri: Uri, context: Context, saveToKiosk: Boolean) {
        viewModelScope.launch {
            showStatus("Uploading...")
            try {
                val contentResolver = context.contentResolver
                val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                val inputStream = contentResolver.openInputStream(uri)
                    ?: throw Exception("Could not open file")
                val bytes = inputStream.readBytes()
                inputStream.close()
                val filename = getFileName(context, uri) ?: "file"

                if (saveToKiosk) {
                    // Upload to kiosk saved files (persistent)
                    val requestBody = bytes.toRequestBody(mimeType.toMediaType())
                    val part = MultipartBody.Part.createFormData("file", filename, requestBody)
                    val response = kioskApi.uploadSavedFile(kioskId, part)

                    if (response.isSuccessful) {
                        val data = response.body()?.data ?: throw Exception("No data")
                        val serverUrl = tokenManager.serverUrl ?: ""
                        val fileUrl = "$serverUrl/api/v1/kiosks/$kioskId/files/${data.id}/serve"

                        castFileToKiosk(kioskId, data.id, fileUrl, data.fileType, mimeType, data.pageCount)
                        loadSavedFiles(kioskId)
                        showStatus("Saved & cast to kiosk")
                    } else {
                        showStatus("Upload failed: ${response.code()}")
                    }
                } else {
                    // Upload to temp fileshare (ephemeral)
                    val requestBody = bytes.toRequestBody(mimeType.toMediaType())
                    val part = MultipartBody.Part.createFormData("file", filename, requestBody)
                    val response = fileShareApi.upload(part)

                    if (response.isSuccessful) {
                        val data = response.body()?.data ?: throw Exception("No data")
                        val serverUrl = tokenManager.serverUrl ?: ""
                        val fileUrl = "$serverUrl/api/v1/fileshare/${data.shareId}/file"

                        castFileToKiosk(kioskId, data.shareId, fileUrl, data.fileType, mimeType, data.pageCount)
                        showStatus("Cast to kiosk")
                    } else {
                        showStatus("Upload failed: ${response.code()}")
                    }
                }
            } catch (e: Exception) {
                showStatus("Failed: ${e.message}")
            }
        }
    }

    private fun castFileToKiosk(
        kioskId: String,
        shareId: String,
        fileUrl: String,
        fileType: String,
        mimeType: String,
        pageCount: Int?,
    ) {
        _currentPdfPages.value = if (fileType == "pdf") pageCount else null
        _currentPage.value = 1

        val payload = buildMap<String, Any> {
            put("shareId", shareId)
            put("fileUrl", fileUrl)
            put("fileType", fileType)
            put("mimeType", mimeType)
            if (pageCount != null) put("pageCount", pageCount)
        }
        sendCommand(kioskId, "file-share", payload)
    }

    // ═══ Saved Files ═══

    fun loadSavedFiles(kioskId: String) {
        viewModelScope.launch {
            try {
                val response = kioskApi.getSavedFiles(kioskId)
                if (response.isSuccessful) {
                    _savedFiles.value = response.body()?.data ?: emptyList()
                }
            } catch (_: Exception) {}
        }
    }

    fun castSavedFile(kioskId: String, file: KioskSavedFileDto) {
        val serverUrl = tokenManager.serverUrl ?: ""
        val fileUrl = "$serverUrl/api/v1/kiosks/$kioskId/files/${file.id}/serve"
        castFileToKiosk(kioskId, file.id, fileUrl, file.fileType, file.mimeType ?: "", file.pageCount)
        showStatus("Cast: ${file.name}")
    }

    fun deleteSavedFile(kioskId: String, fileId: String) {
        viewModelScope.launch {
            try {
                kioskApi.deleteSavedFile(kioskId, fileId)
                loadSavedFiles(kioskId)
                showStatus("File deleted")
            } catch (e: Exception) {
                showStatus("Delete failed")
            }
        }
    }

    // ═══ PDF Page Navigation ═══

    fun pdfPageNext(kioskId: String) {
        val pages = _currentPdfPages.value ?: return
        val next = (_currentPage.value + 1).coerceAtMost(pages)
        _currentPage.value = next
        sendCommand(kioskId, "file-share-page", mapOf("page" to next))
    }

    fun pdfPagePrev(kioskId: String) {
        val prev = (_currentPage.value - 1).coerceAtLeast(1)
        _currentPage.value = prev
        sendCommand(kioskId, "file-share-page", mapOf("page" to prev))
    }

    fun pdfGoToPage(kioskId: String, page: Int) {
        val pages = _currentPdfPages.value ?: return
        val clamped = page.coerceIn(1, pages)
        _currentPage.value = clamped
        sendCommand(kioskId, "file-share-page", mapOf("page" to clamped))
    }

    // ═══ Helpers ═══

    private fun getFileName(context: Context, uri: Uri): String? {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        return cursor?.use {
            val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (it.moveToFirst() && nameIndex >= 0) it.getString(nameIndex) else null
        }
    }

    private fun showStatus(message: String) {
        viewModelScope.launch {
            _commandStatus.value = message
            delay(2000)
            _commandStatus.value = null
        }
    }
}
