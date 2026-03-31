package us.openframe.app.ui.photos

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import us.openframe.app.data.remote.api.PhotoApi
import us.openframe.app.data.remote.dto.CreateAlbumRequest
import us.openframe.app.data.repository.PhotoRepository
import javax.inject.Inject

@HiltViewModel
class AlbumDetailViewModel @Inject constructor(
    private val photoRepository: PhotoRepository,
    private val photoApi: PhotoApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow<AlbumDetailUiState>(AlbumDetailUiState.Loading)
    val uiState: StateFlow<AlbumDetailUiState> = _uiState.asStateFlow()

    fun loadAlbum(albumId: String) {
        viewModelScope.launch {
            _uiState.value = AlbumDetailUiState.Loading
            photoRepository.getAlbumPhotos(albumId).fold(
                onSuccess = { _uiState.value = AlbumDetailUiState.Success(it) },
                onFailure = {
                    _uiState.value = AlbumDetailUiState.Error("${it::class.simpleName}: ${it.message}")
                },
            )
        }
    }

    fun uploadPhoto(albumId: String, uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                val contentResolver = context.contentResolver
                val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
                val inputStream = contentResolver.openInputStream(uri) ?: return@launch
                val bytes = inputStream.readBytes()
                inputStream.close()

                val filename = getFileName(context, uri) ?: "photo.jpg"
                val requestBody = bytes.toRequestBody(mimeType.toMediaType())
                val part = MultipartBody.Part.createFormData("photo", filename, requestBody)

                val response = photoApi.uploadPhoto(albumId, part)
                if (response.isSuccessful) {
                    // Reload album to show the new photo
                    loadAlbum(albumId)
                }
            } catch (_: Exception) {}
        }
    }

    fun getPhotoUrl(path: String?): String? = photoRepository.getPhotoUrl(path)

    private fun getFileName(context: Context, uri: Uri): String? {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        return cursor?.use {
            val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (it.moveToFirst() && nameIndex >= 0) it.getString(nameIndex) else null
        }
    }
}
