package us.openframe.app.ui.recipes

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import us.openframe.app.domain.model.Recipe
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.LoadingState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipeDetailScreen(
    viewModel: RecipesViewModel,
    recipeId: String,
    onBack: () -> Unit,
) {
    val detailState by viewModel.detailState.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(recipeId) {
        viewModel.loadRecipe(recipeId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recipe") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    val state = detailState
                    if (state is RecipeDetailState.Success) {
                        IconButton(onClick = { viewModel.toggleFavorite(state.recipe.id) }) {
                            Icon(
                                if (state.recipe.isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                "Favorite",
                                tint = if (state.recipe.isFavorite) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Outlined.Delete, "Delete")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        when (val state = detailState) {
            is RecipeDetailState.Loading -> LoadingState(modifier = Modifier.padding(padding))
            is RecipeDetailState.Error -> ErrorState(
                state.message,
                modifier = Modifier.padding(padding),
                onRetry = { viewModel.loadRecipe(recipeId) },
            )
            is RecipeDetailState.Success -> {
                RecipeContent(
                    recipe = state.recipe,
                    imageUrl = viewModel.getImageUrl(state.recipe.sourceImagePath),
                    modifier = Modifier.padding(padding),
                )
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Recipe") },
            text = { Text("Are you sure you want to delete this recipe?") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    val state = detailState
                    if (state is RecipeDetailState.Success) {
                        viewModel.deleteRecipe(state.recipe.id) { onBack() }
                    }
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun RecipeContent(
    recipe: Recipe,
    imageUrl: String?,
    modifier: Modifier = Modifier,
) {
    val checkedIngredients = remember { mutableStateMapOf<Int, Boolean>() }
    val checkedSteps = remember { mutableStateMapOf<Int, Boolean>() }

    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(bottom = 32.dp),
    ) {
        // Hero image
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = recipe.title,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(240.dp)
                    .clip(RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp)),
                contentScale = ContentScale.Crop,
            )
        }

        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // Title
            Text(
                recipe.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )

            // Description
            recipe.description?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            // Meta row
            val metaItems = buildList {
                recipe.prepTime?.let { add("Prep: ${it}m") }
                recipe.cookTime?.let { add("Cook: ${it}m") }
                recipe.totalTime?.let { add("Total: ${it}m") }
                recipe.servings?.let { add("Serves: $it") }
            }
            if (metaItems.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    metaItems.forEach { item ->
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                        ) {
                            Text(
                                item,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }

            // Tags
            if (recipe.tags.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    recipe.tags.forEach { tag ->
                        SuggestionChip(
                            onClick = {},
                            label = { Text(tag, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
            }

            // Ingredients
            if (recipe.ingredients.isNotEmpty()) {
                Text(
                    "Ingredients",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                recipe.ingredients.forEachIndexed { index, ingredient ->
                    val checked = checkedIngredients[index] == true
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = checked,
                            onCheckedChange = { checkedIngredients[index] = it },
                            modifier = Modifier.size(32.dp),
                            colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            ingredient.displayText,
                            style = MaterialTheme.typography.bodyMedium,
                            textDecoration = if (checked) TextDecoration.LineThrough else null,
                            color = if (checked) MaterialTheme.colorScheme.onSurfaceVariant
                            else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }

            // Instructions
            if (recipe.instructions.isNotEmpty()) {
                Text(
                    "Instructions",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                recipe.instructions.forEachIndexed { index, step ->
                    val checked = checkedSteps[index] == true
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        crossAxisAlignment = FlowCrossAxisAlignment.Start,
                    ) {
                        Checkbox(
                            checked = checked,
                            onCheckedChange = { checkedSteps[index] = it },
                            modifier = Modifier.size(32.dp),
                            colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                "Step ${index + 1}",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Text(
                                step,
                                style = MaterialTheme.typography.bodyMedium,
                                textDecoration = if (checked) TextDecoration.LineThrough else null,
                                color = if (checked) MaterialTheme.colorScheme.onSurfaceVariant
                                else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }

            // Notes
            recipe.notes?.let { notes ->
                Text(
                    "Notes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(notes, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

// Helper for Row with cross-axis alignment at start (top-align checkbox with multi-line text)
private enum class FlowCrossAxisAlignment { Start }

@Composable
private fun Row(
    modifier: Modifier = Modifier,
    crossAxisAlignment: FlowCrossAxisAlignment,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.Top,
        content = content,
    )
}
