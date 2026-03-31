package us.openframe.app.ui.recipes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.remote.dto.CreateRecipeRequest
import us.openframe.app.data.remote.dto.RecipeIngredientDto
import us.openframe.app.data.repository.RecipeRepository
import us.openframe.app.domain.model.Recipe
import java.io.File
import javax.inject.Inject

sealed interface RecipesUiState {
    data object Loading : RecipesUiState
    data class Success(val recipes: List<Recipe>) : RecipesUiState
    data class Error(val message: String) : RecipesUiState
}

sealed interface RecipeDetailState {
    data object Loading : RecipeDetailState
    data class Success(val recipe: Recipe) : RecipeDetailState
    data class Error(val message: String) : RecipeDetailState
}

sealed interface ScanState {
    data object Idle : ScanState
    data object Uploading : ScanState
    data object Processing : ScanState
    data class Success(val recipe: Recipe) : ScanState
    data class Error(val message: String) : ScanState
}

@HiltViewModel
class RecipesViewModel @Inject constructor(
    private val recipeRepository: RecipeRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<RecipesUiState>(RecipesUiState.Loading)
    val uiState: StateFlow<RecipesUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow<RecipeDetailState>(RecipeDetailState.Loading)
    val detailState: StateFlow<RecipeDetailState> = _detailState.asStateFlow()

    private val _scanState = MutableStateFlow<ScanState>(ScanState.Idle)
    val scanState: StateFlow<ScanState> = _scanState.asStateFlow()

    private val _tags = MutableStateFlow<List<String>>(emptyList())
    val tags: StateFlow<List<String>> = _tags.asStateFlow()

    private val _selectedTag = MutableStateFlow<String?>(null)
    val selectedTag: StateFlow<String?> = _selectedTag.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    init {
        loadRecipes()
        loadTags()
    }

    fun loadRecipes() {
        viewModelScope.launch {
            _uiState.value = RecipesUiState.Loading
            recipeRepository.getRecipes(tag = _selectedTag.value)
                .onSuccess { recipes ->
                    val query = _searchQuery.value.lowercase()
                    val filtered = if (query.isBlank()) recipes
                    else recipes.filter {
                        it.title.lowercase().contains(query) ||
                            it.description?.lowercase()?.contains(query) == true ||
                            it.tags.any { t -> t.contains(query) }
                    }
                    _uiState.value = RecipesUiState.Success(filtered)
                }
                .onFailure { _uiState.value = RecipesUiState.Error(it.message ?: "Unknown error") }
        }
    }

    private fun loadTags() {
        viewModelScope.launch {
            recipeRepository.getTags().onSuccess { _tags.value = it }
        }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
        loadRecipes()
    }

    fun selectTag(tag: String?) {
        _selectedTag.value = if (_selectedTag.value == tag) null else tag
        loadRecipes()
    }

    fun loadRecipe(id: String) {
        viewModelScope.launch {
            _detailState.value = RecipeDetailState.Loading
            recipeRepository.getRecipe(id)
                .onSuccess { _detailState.value = RecipeDetailState.Success(it) }
                .onFailure { _detailState.value = RecipeDetailState.Error(it.message ?: "Error") }
        }
    }

    fun toggleFavorite(id: String) {
        viewModelScope.launch {
            recipeRepository.toggleFavorite(id)
                .onSuccess { updated ->
                    // Update in list
                    val current = _uiState.value
                    if (current is RecipesUiState.Success) {
                        _uiState.value = RecipesUiState.Success(
                            current.recipes.map { if (it.id == id) updated else it }
                        )
                    }
                    // Update detail if viewing
                    val detail = _detailState.value
                    if (detail is RecipeDetailState.Success && detail.recipe.id == id) {
                        _detailState.value = RecipeDetailState.Success(updated)
                    }
                }
        }
    }

    fun deleteRecipe(id: String, onDone: () -> Unit) {
        viewModelScope.launch {
            recipeRepository.deleteRecipe(id)
                .onSuccess {
                    loadRecipes()
                    onDone()
                }
                .onFailure { _statusMessage.value = "Failed to delete: ${it.message}" }
        }
    }

    fun createRecipe(
        title: String,
        description: String?,
        servings: Int?,
        prepTime: Int?,
        cookTime: Int?,
        ingredients: List<Triple<String, String, String>>,
        instructions: List<String>,
        tags: List<String>,
        notes: String?,
        onSuccess: (Recipe) -> Unit,
    ) {
        viewModelScope.launch {
            val request = CreateRecipeRequest(
                title = title,
                description = description?.ifBlank { null },
                servings = servings,
                prepTime = prepTime,
                cookTime = cookTime,
                ingredients = ingredients
                    .filter { it.third.isNotBlank() }
                    .map { RecipeIngredientDto(name = it.third, amount = it.first, unit = it.second) },
                instructions = instructions.filter { it.isNotBlank() },
                tags = tags.filter { it.isNotBlank() }.map { it.lowercase().trim() },
                notes = notes?.ifBlank { null },
            )
            recipeRepository.createRecipe(request)
                .onSuccess {
                    loadRecipes()
                    loadTags()
                    onSuccess(it)
                }
                .onFailure { _statusMessage.value = "Failed to create: ${it.message}" }
        }
    }

    fun uploadRecipeImage(imageFile: File) {
        viewModelScope.launch {
            _scanState.value = ScanState.Uploading
            _scanState.value = ScanState.Processing
            recipeRepository.uploadRecipeImage(imageFile)
                .onSuccess {
                    _scanState.value = ScanState.Success(it)
                    loadRecipes()
                    loadTags()
                }
                .onFailure {
                    _scanState.value = ScanState.Error(it.message ?: "Upload failed")
                }
        }
    }

    fun getImageUrl(path: String?): String? = recipeRepository.getImageUrl(path)

    fun resetScanState() {
        _scanState.value = ScanState.Idle
    }

    fun clearStatusMessage() {
        _statusMessage.value = null
    }
}
