package us.openframe.app.ui.photos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.repository.PhotoRepository
import us.openframe.app.domain.model.Photo
import us.openframe.app.domain.model.PhotoAlbum
import javax.inject.Inject

sealed interface PhotosUiState {
    data object Loading : PhotosUiState
    data class Success(val albums: List<PhotoAlbum>) : PhotosUiState
    data class Error(val message: String) : PhotosUiState
}

sealed interface AlbumDetailUiState {
    data object Loading : AlbumDetailUiState
    data class Success(val photos: List<Photo>) : AlbumDetailUiState
    data class Error(val message: String) : AlbumDetailUiState
}

@HiltViewModel
class PhotosViewModel @Inject constructor(
    private val photoRepository: PhotoRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<PhotosUiState>(PhotosUiState.Loading)
    val uiState: StateFlow<PhotosUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = PhotosUiState.Loading
            photoRepository.getAlbums().fold(
                onSuccess = { _uiState.value = PhotosUiState.Success(it) },
                onFailure = { _uiState.value = PhotosUiState.Error(it.message ?: "Failed") },
            )
        }
    }

    fun getCoverUrl(album: PhotoAlbum): String? {
        return photoRepository.getPhotoUrl(album.coverPhotoPath)
    }
}
