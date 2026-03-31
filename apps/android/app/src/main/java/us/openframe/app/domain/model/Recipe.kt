package us.openframe.app.domain.model

data class Recipe(
    val id: String,
    val title: String,
    val description: String? = null,
    val servings: Int? = null,
    val prepTime: Int? = null,
    val cookTime: Int? = null,
    val ingredients: List<RecipeIngredient> = emptyList(),
    val instructions: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val notes: String? = null,
    val sourceImagePath: String? = null,
    val thumbnailPath: String? = null,
    val isFavorite: Boolean = false,
) {
    val totalTime: Int? get() = when {
        prepTime != null && cookTime != null -> prepTime + cookTime
        prepTime != null -> prepTime
        cookTime != null -> cookTime
        else -> null
    }
}

data class RecipeIngredient(
    val name: String,
    val amount: String = "",
    val unit: String = "",
) {
    val displayText: String get() = buildString {
        if (amount.isNotBlank()) append("$amount ")
        if (unit.isNotBlank()) append("$unit ")
        append(name)
    }.trim()
}
