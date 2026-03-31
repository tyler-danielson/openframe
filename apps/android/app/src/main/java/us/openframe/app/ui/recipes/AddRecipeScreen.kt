package us.openframe.app.ui.recipes

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddRecipeScreen(
    viewModel: RecipesViewModel,
    onBack: () -> Unit,
    onRecipeCreated: (String) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var servings by remember { mutableStateOf("") }
    var prepTime by remember { mutableStateOf("") }
    var cookTime by remember { mutableStateOf("") }
    var tags by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }

    // Dynamic ingredient list: (amount, unit, name)
    val ingredients = remember { mutableStateListOf(Triple("", "", "")) }
    // Dynamic instruction list
    val instructions = remember { mutableStateListOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New Recipe") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            if (title.isNotBlank() && !isSaving) {
                                isSaving = true
                                viewModel.createRecipe(
                                    title = title,
                                    description = description.ifBlank { null },
                                    servings = servings.toIntOrNull(),
                                    prepTime = prepTime.toIntOrNull(),
                                    cookTime = cookTime.toIntOrNull(),
                                    ingredients = ingredients.toList(),
                                    instructions = instructions.toList(),
                                    tags = tags.split(",").map { it.trim() },
                                    notes = notes.ifBlank { null },
                                    onSuccess = { recipe ->
                                        isSaving = false
                                        onRecipeCreated(recipe.id)
                                    },
                                )
                            }
                        },
                        enabled = title.isNotBlank() && !isSaving,
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Save", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
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
        Column(
            modifier = Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Title
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
            )

            // Description
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                minLines = 2,
            )

            // Time row
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = prepTime,
                    onValueChange = { prepTime = it.filter { c -> c.isDigit() } },
                    label = { Text("Prep (min)") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = cookTime,
                    onValueChange = { cookTime = it.filter { c -> c.isDigit() } },
                    label = { Text("Cook (min)") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = servings,
                    onValueChange = { servings = it.filter { c -> c.isDigit() } },
                    label = { Text("Servings") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }

            // Ingredients section
            SectionHeader("Ingredients") {
                ingredients.add(Triple("", "", ""))
            }
            ingredients.forEachIndexed { index, (amount, unit, name) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { ingredients[index] = Triple(it, unit, name) },
                        placeholder = { Text("Amt", style = MaterialTheme.typography.bodySmall) },
                        singleLine = true,
                        modifier = Modifier.width(56.dp),
                        shape = RoundedCornerShape(8.dp),
                        textStyle = MaterialTheme.typography.bodySmall,
                    )
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { ingredients[index] = Triple(amount, it, name) },
                        placeholder = { Text("Unit", style = MaterialTheme.typography.bodySmall) },
                        singleLine = true,
                        modifier = Modifier.width(64.dp),
                        shape = RoundedCornerShape(8.dp),
                        textStyle = MaterialTheme.typography.bodySmall,
                    )
                    OutlinedTextField(
                        value = name,
                        onValueChange = { ingredients[index] = Triple(amount, unit, it) },
                        placeholder = { Text("Ingredient", style = MaterialTheme.typography.bodySmall) },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp),
                        textStyle = MaterialTheme.typography.bodySmall,
                    )
                    if (ingredients.size > 1) {
                        IconButton(
                            onClick = { ingredients.removeAt(index) },
                            modifier = Modifier.size(28.dp),
                        ) {
                            Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            // Instructions section
            SectionHeader("Instructions") {
                instructions.add("")
            }
            instructions.forEachIndexed { index, step ->
                Row(
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        "${index + 1}.",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 14.dp),
                    )
                    OutlinedTextField(
                        value = step,
                        onValueChange = { instructions[index] = it },
                        placeholder = { Text("Step ${index + 1}") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp),
                        minLines = 2,
                    )
                    if (instructions.size > 1) {
                        IconButton(
                            onClick = { instructions.removeAt(index) },
                            modifier = Modifier
                                .size(28.dp)
                                .padding(top = 10.dp),
                        ) {
                            Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            // Tags
            OutlinedTextField(
                value = tags,
                onValueChange = { tags = it },
                label = { Text("Tags (comma-separated)") },
                placeholder = { Text("dinner, easy, chicken") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
            )

            // Notes
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                minLines = 3,
            )

            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String, onAdd: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
        FilledTonalIconButton(onClick = onAdd, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Default.Add, "Add", modifier = Modifier.size(16.dp))
        }
    }
}
