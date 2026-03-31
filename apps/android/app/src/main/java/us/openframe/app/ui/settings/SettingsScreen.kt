package us.openframe.app.ui.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import us.openframe.app.data.remote.api.SettingCategoryDef
import us.openframe.app.domain.model.Calendar
import us.openframe.app.ui.AppScreen
import us.openframe.app.ui.theme.OpenFrameColorScheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val user by viewModel.user.collectAsState()
    val calendars by viewModel.calendars.collectAsState()
    val currentScheme by viewModel.colorScheme.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val definitions by viewModel.definitions.collectAsState()
    val modules by viewModel.modules.collectAsState()
    val statusMessage by viewModel.statusMessage.collectAsState()
    val context = LocalContext.current

    // Track which sections are expanded
    var expandedSection by remember { mutableStateOf<String?>("account") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
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
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Status message
            statusMessage?.let {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                    ),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            // ═══ Account ═══
            SettingsSection(
                title = "Account",
                icon = Icons.Outlined.Person,
                expanded = expandedSection == "account",
                onToggle = { expandedSection = if (expandedSection == "account") null else "account" },
            ) {
                user?.let { u ->
                    Row(
                        modifier = Modifier.padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Surface(
                            modifier = Modifier.size(48.dp),
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = (u.name ?: u.email).take(1).uppercase(),
                                    style = MaterialTheme.typography.titleLarge,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(u.name ?: "User", style = MaterialTheme.typography.bodyLarge)
                            Text(u.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (u.role != null) {
                                Text(
                                    u.role.replaceFirstChar { it.uppercase() },
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    }

                    viewModel.serverUrl?.let { url ->
                        SettingsInfoRow("Server", url)
                    }
                }
            }

            // ═══ Appearance ═══
            SettingsSection(
                title = "Appearance",
                icon = Icons.Outlined.Palette,
                expanded = expandedSection == "appearance",
                onToggle = { expandedSection = if (expandedSection == "appearance") null else "appearance" },
            ) {
                Text("Color Scheme", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OpenFrameColorScheme.entries.forEach { scheme ->
                        val isSelected = scheme.key == currentScheme
                        Surface(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .clickable { viewModel.setColorScheme(scheme.key) },
                            shape = CircleShape,
                            color = scheme.accentColor,
                        ) {
                            if (isSelected) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("\u2713", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            // ═══ Toolbar ═══
            val pinnedTabs by viewModel.pinnedTabs.collectAsState()

            SettingsSection(
                title = "Toolbar",
                icon = Icons.Outlined.ViewWeek,
                expanded = expandedSection == "toolbar",
                onToggle = { expandedSection = if (expandedSection == "toolbar") null else "toolbar" },
            ) {
                Text(
                    "Choose up to 4 screens to pin to the bottom toolbar. Others are in More.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(8.dp))

                AppScreen.entries.forEach { screen ->
                    val isPinned = pinnedTabs.contains(screen.route)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.togglePinnedTab(screen.route) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = isPinned,
                            onCheckedChange = { viewModel.togglePinnedTab(screen.route) },
                            colors = CheckboxDefaults.colors(
                                checkedColor = MaterialTheme.colorScheme.primary,
                            ),
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            screen.unselectedIcon,
                            null,
                            tint = if (isPinned) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            screen.label,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }

            // ═══ Calendars ═══
            SettingsSection(
                title = "Calendars",
                icon = Icons.Outlined.CalendarMonth,
                expanded = expandedSection == "calendars",
                onToggle = { expandedSection = if (expandedSection == "calendars") null else "calendars" },
            ) {
                Button(
                    onClick = { viewModel.syncAll() },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isSyncing,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                ) {
                    Icon(Icons.Default.Sync, null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (isSyncing) "Syncing..." else "Sync All Calendars")
                }

                Spacer(modifier = Modifier.height(8.dp))

                calendars.forEach { calendar ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.toggleCalendarVisibility(calendar) }
                            .padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Switch(
                            checked = calendar.isVisible,
                            onCheckedChange = { viewModel.toggleCalendarVisibility(calendar) },
                            colors = SwitchDefaults.colors(
                                checkedTrackColor = MaterialTheme.colorScheme.primary,
                            ),
                            modifier = Modifier.height(28.dp),
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(calendar.effectiveName, style = MaterialTheme.typography.bodyMedium)
                            if (calendar.provider != null) {
                                Text(calendar.provider, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }

            // ═══ Connections (OAuth-linked services) ═══
            SettingsSection(
                title = "Connections",
                icon = Icons.Outlined.Link,
                expanded = expandedSection == "connections",
                onToggle = { expandedSection = if (expandedSection == "connections") null else "connections" },
            ) {
                Text(
                    "Manage linked services like Spotify, Google, and Microsoft from the web app.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(8.dp))

                val services = listOf(
                    Triple("Spotify", Icons.Outlined.MusicNote, "/app/settings?tab=connections"),
                    Triple("Google", Icons.Outlined.Email, "/app/settings?tab=connections"),
                    Triple("Microsoft", Icons.Outlined.Cloud, "/app/settings?tab=connections"),
                )
                services.forEach { (name, icon, path) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable {
                                val url = (viewModel.serverUrl
                                    ?: "https://openframe.us") + path
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        Icon(
                            Icons.Outlined.OpenInNew, null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            // ═══ Modules ═══
            if (modules.isNotEmpty()) {
                SettingsSection(
                    title = "Modules",
                    icon = Icons.Outlined.Extension,
                    expanded = expandedSection == "modules",
                    onToggle = { expandedSection = if (expandedSection == "modules") null else "modules" },
                ) {
                    // Group by category
                    val grouped = modules.groupBy { it.category ?: "other" }
                    grouped.forEach { (category, mods) ->
                        Text(
                            category.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                        mods.forEach { module ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = module.available) { viewModel.toggleModule(module) }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Switch(
                                    checked = module.enabled,
                                    onCheckedChange = { viewModel.toggleModule(module) },
                                    enabled = module.available,
                                    colors = SwitchDefaults.colors(
                                        checkedTrackColor = MaterialTheme.colorScheme.primary,
                                    ),
                                    modifier = Modifier.height(28.dp),
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        module.name,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = if (module.available) MaterialTheme.colorScheme.onSurface
                                        else MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    if (!module.available) {
                                        Text(
                                            "Upgrade to enable",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.error,
                                        )
                                    } else if (module.description != null) {
                                        Text(
                                            module.description,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ═══ Dynamic Settings Categories ═══
            val aiCategories = setOf("openai", "anthropic", "grok", "openrouter", "local_llm", "chat")
            val connectionCategories = listOf("home", "weather", "homeassistant", "telegram", "handwriting", "recipes")

            val categoryIcons = mapOf(
                "home" to Icons.Outlined.Home,
                "weather" to Icons.Outlined.Cloud,
                "homeassistant" to Icons.Outlined.SmartToy,
                "spotify" to Icons.Outlined.MusicNote,
                "telegram" to Icons.Outlined.Send,
                "handwriting" to Icons.Outlined.Draw,
                "recipes" to Icons.Outlined.Restaurant,
            )

            // ═══ Connections (non-AI settings) ═══
            definitions
                .filter { it.category in connectionCategories && it.settings.isNotEmpty() }
                .forEach { category ->
                    val sectionKey = "cat_${category.category}"
                    SettingsSection(
                        title = category.label,
                        icon = categoryIcons[category.category] ?: Icons.Outlined.Settings,
                        expanded = expandedSection == sectionKey,
                        onToggle = { expandedSection = if (expandedSection == sectionKey) null else sectionKey },
                    ) {
                        category.settings.forEach { setting ->
                            SettingsField(
                                label = setting.label,
                                description = setting.description,
                                value = viewModel.getSettingValue(category.category, setting.key) ?: "",
                                isSecret = setting.isSecret,
                                placeholder = setting.placeholder,
                                category = category.category,
                                key = setting.key,
                                onSave = { value ->
                                    viewModel.updateSetting(category.category, setting.key, value.ifBlank { null })
                                },
                            )
                        }
                    }
                }

            // ═══ AI (grouped under one section) ═══
            val aiDefs = definitions.filter { it.category in aiCategories && it.settings.isNotEmpty() }
            if (aiDefs.isNotEmpty()) {
                SettingsSection(
                    title = "AI",
                    icon = Icons.Outlined.AutoAwesome,
                    expanded = expandedSection == "ai",
                    onToggle = { expandedSection = if (expandedSection == "ai") null else "ai" },
                ) {
                    aiDefs.forEach { category ->
                        Text(
                            category.label,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                        )
                        category.settings.forEach { setting ->
                            SettingsField(
                                label = setting.label,
                                description = setting.description,
                                value = viewModel.getSettingValue(category.category, setting.key) ?: "",
                                isSecret = setting.isSecret,
                                placeholder = setting.placeholder,
                                category = category.category,
                                key = setting.key,
                                onSave = { value ->
                                    viewModel.updateSetting(category.category, setting.key, value.ifBlank { null })
                                },
                            )
                        }
                    }
                }
            }

            // ═══ Plan & Billing ═══
            SettingsSection(
                title = "Plan & Billing",
                icon = Icons.Outlined.CreditCard,
                expanded = expandedSection == "billing",
                onToggle = { expandedSection = if (expandedSection == "billing") null else "billing" },
            ) {
                OutlinedButton(
                    onClick = {
                        context.startActivity(
                            Intent(Intent.ACTION_VIEW, Uri.parse("https://openframe.us/pricing"))
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Outlined.OpenInNew, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Manage Plan")
                }
            }

            // ═══ Advanced ═══
            SettingsSection(
                title = "Advanced",
                icon = Icons.Outlined.Tune,
                expanded = expandedSection == "advanced",
                onToggle = { expandedSection = if (expandedSection == "advanced") null else "advanced" },
            ) {
                OutlinedButton(
                    onClick = {
                        val url = (viewModel.serverUrl ?: "https://openframe.us") + "/app/settings"
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(Icons.Outlined.OpenInNew, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Open Full Settings in Browser")
                }

                Spacer(modifier = Modifier.height(8.dp))

                SettingsInfoRow("App Version", "1.0.0")
                SettingsInfoRow("Package", "us.openframe.app")
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ═══ Sign Out ═══
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sign Out")
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

// ═══ Reusable Components ═══

@Composable
private fun SettingsSection(
    title: String,
    icon: ImageVector,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    icon, null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    "Toggle",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            AnimatedVisibility(visible = expanded) {
                Column(
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    content = content,
                )
            }
        }
    }
}

@Composable
private fun SettingsInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface)
    }
}

/** Known dropdown options for specific setting fields (category/key) */
private val SETTING_OPTIONS = mapOf(
    "handwriting/provider" to listOf(
        "tesseract" to "Tesseract (Local OCR)",
        "gemini" to "Google Gemini Vision",
        "openai" to "OpenAI GPT-4o Vision",
        "claude" to "Claude Vision",
        "google_vision" to "Google Cloud Vision",
    ),
    "recipes/ai_provider" to listOf(
        "openai" to "OpenAI",
        "anthropic" to "Claude (Anthropic)",
        "gemini" to "Google Gemini",
        "grok" to "Grok (xAI)",
        "openrouter" to "OpenRouter",
        "local_llm" to "Local LLM",
    ),
    "chat/provider" to listOf(
        "openai" to "OpenAI",
        "anthropic" to "Claude (Anthropic)",
        "gemini" to "Google Gemini",
        "grok" to "Grok (xAI)",
        "openrouter" to "OpenRouter",
        "local_llm" to "Local LLM",
    ),
    "weather/units" to listOf(
        "metric" to "Metric (\u00b0C)",
        "imperial" to "Imperial (\u00b0F)",
    ),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsField(
    label: String,
    description: String?,
    value: String,
    isSecret: Boolean,
    placeholder: String?,
    onSave: (String) -> Unit,
    category: String = "",
    key: String = "",
) {
    val options = SETTING_OPTIONS["$category/$key"]

    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface)
        if (description != null) {
            Text(description, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(modifier = Modifier.height(4.dp))

        if (options != null) {
            // Dropdown selector
            var expanded by remember { mutableStateOf(false) }
            val selectedLabel = options.find { it.first == value }?.second ?: value.ifEmpty { "Not set" }

            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = it },
            ) {
                OutlinedTextField(
                    value = selectedLabel,
                    onValueChange = {},
                    readOnly = true,
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    shape = RoundedCornerShape(10.dp),
                    textStyle = MaterialTheme.typography.bodySmall,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                    ),
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false },
                ) {
                    options.forEach { (optValue, optLabel) ->
                        DropdownMenuItem(
                            text = { Text(optLabel, style = MaterialTheme.typography.bodySmall) },
                            onClick = {
                                expanded = false
                                onSave(optValue)
                            },
                            leadingIcon = if (optValue == value) {
                                { Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary) }
                            } else null,
                        )
                    }
                }
            }
        } else {
            // Text input field
            var editValue by remember(value) { mutableStateOf(value) }
            var isEditing by remember { mutableStateOf(false) }
            val isDirty = editValue != value

            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = editValue,
                    onValueChange = { editValue = it; isEditing = true },
                    placeholder = placeholder?.let { { Text(it, style = MaterialTheme.typography.bodySmall) } },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    textStyle = MaterialTheme.typography.bodySmall,
                    visualTransformation = if (isSecret && !isEditing) PasswordVisualTransformation() else VisualTransformation.None,
                    keyboardOptions = if (label.contains("latitude", true) || label.contains("longitude", true)) {
                        KeyboardOptions(keyboardType = KeyboardType.Decimal)
                    } else {
                        KeyboardOptions.Default
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                    ),
                )
                if (isDirty) {
                    Spacer(modifier = Modifier.width(6.dp))
                    FilledTonalIconButton(
                        onClick = { onSave(editValue); isEditing = false },
                        modifier = Modifier.size(36.dp),
                    ) {
                        Icon(Icons.Default.Check, "Save", modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}
