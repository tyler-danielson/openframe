package us.openframe.app.ui.kiosk

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.LoadingState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KioskControlScreen(
    kioskId: String,
    onBack: () -> Unit,
    viewModel: KioskViewModel = hiltViewModel(),
) {
    val detailState by viewModel.detailState.collectAsState()
    val commandStatus by viewModel.commandStatus.collectAsState()
    val savedFiles by viewModel.savedFiles.collectAsState()
    val currentPdfPages by viewModel.currentPdfPages.collectAsState()
    val currentPage by viewModel.currentPage.collectAsState()
    var showCastDialog by remember { mutableStateOf(false) }
    var castUrl by remember { mutableStateOf("") }
    var saveToKiosk by remember { mutableStateOf(true) }
    val context = LocalContext.current

    // Photo picker (images only)
    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri != null) {
            viewModel.uploadAndCastFile(kioskId, uri, context, saveToKiosk)
        }
    }

    // Document picker (PDFs)
    val pdfPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) {
            viewModel.uploadAndCastFile(kioskId, uri, context, saveToKiosk)
        }
    }

    LaunchedEffect(kioskId) {
        viewModel.loadKiosk(kioskId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kiosk Control") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
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
            is KioskDetailUiState.Loading -> LoadingState(Modifier.padding(padding))
            is KioskDetailUiState.Error -> ErrorState(
                state.message,
                onRetry = { viewModel.loadKiosk(kioskId) },
                modifier = Modifier.padding(padding),
            )
            is KioskDetailUiState.Success -> {
                val kiosk = state.kiosk

                Column(
                    modifier = Modifier
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Kiosk info header
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Surface(
                                modifier = Modifier.size(48.dp),
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Outlined.Tv,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(24.dp),
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = kiosk.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                Text(
                                    text = "${kiosk.displayType ?: "Display"} \u2022 ${kiosk.displayMode ?: "Full"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            // Status dot
                            Surface(
                                modifier = Modifier.size(10.dp),
                                shape = RoundedCornerShape(5.dp),
                                color = if (kiosk.isActive) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
                            ) {}
                        }
                    }

                    // Command status snackbar
                    commandStatus?.let { status ->
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                            ),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Text(
                                text = status,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }

                    // ═══ Quick Actions ═══
                    SectionHeader("Quick Actions")

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        ActionButton(
                            icon = Icons.Default.Refresh,
                            label = "Refresh",
                            modifier = Modifier.weight(1f),
                            onClick = { viewModel.sendCommand(kioskId, "refresh") },
                        )
                        ActionButton(
                            icon = Icons.Outlined.Fullscreen,
                            label = "Fullscreen",
                            modifier = Modifier.weight(1f),
                            onClick = { viewModel.sendCommand(kioskId, "fullscreen") },
                        )
                        ActionButton(
                            icon = Icons.Outlined.Nightlight,
                            label = "Screensaver",
                            modifier = Modifier.weight(1f),
                            onClick = { viewModel.sendCommand(kioskId, "screensaver") },
                        )
                    }

                    // ═══ Cast to Screen ═══
                    SectionHeader("Cast to Screen")

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        ActionButton(
                            icon = Icons.Outlined.Language,
                            label = "Webpage",
                            modifier = Modifier.weight(1f),
                            onClick = { showCastDialog = true },
                        )
                        ActionButton(
                            icon = Icons.Outlined.PhotoLibrary,
                            label = "Photo",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                photoPicker.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                        )
                        ActionButton(
                            icon = Icons.Outlined.PictureAsPdf,
                            label = "PDF",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                pdfPicker.launch(arrayOf("application/pdf"))
                            },
                        )
                        ActionButton(
                            icon = Icons.Outlined.StopCircle,
                            label = "Dismiss",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                viewModel.sendCommand(kioskId, "dismiss-webpage")
                                viewModel.sendCommand(kioskId, "file-share-dismiss")
                            },
                        )
                    }

                    // Save toggle
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = saveToKiosk,
                            onCheckedChange = { saveToKiosk = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = MaterialTheme.colorScheme.primary,
                            ),
                        )
                        Text(
                            text = "Save to kiosk for later",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    // ═══ PDF Page Navigation (shown when PDF is active) ═══
                    if (currentPdfPages != null) {
                        SectionHeader("PDF Navigation")

                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                            ),
                            shape = RoundedCornerShape(14.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                FilledTonalIconButton(
                                    onClick = { viewModel.pdfPagePrev(kioskId) },
                                    enabled = currentPage > 1,
                                ) {
                                    Icon(Icons.Default.ChevronLeft, "Previous")
                                }

                                Text(
                                    text = "$currentPage / $currentPdfPages",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )

                                FilledTonalIconButton(
                                    onClick = { viewModel.pdfPageNext(kioskId) },
                                    enabled = currentPage < (currentPdfPages ?: 1),
                                ) {
                                    Icon(Icons.Default.ChevronRight, "Next")
                                }
                            }
                        }
                    }

                    // ═══ Saved Files ═══
                    if (savedFiles.isNotEmpty()) {
                        SectionHeader("Saved Files")

                        savedFiles.forEach { file ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable { viewModel.castSavedFile(kioskId, file) },
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surface,
                                ),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(
                                        if (file.fileType == "pdf") Icons.Outlined.PictureAsPdf
                                        else Icons.Outlined.Image,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = file.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium,
                                            color = MaterialTheme.colorScheme.onSurface,
                                            maxLines = 1,
                                        )
                                        val details = buildString {
                                            append(file.fileType.uppercase())
                                            if (file.pageCount != null) append(" \u2022 ${file.pageCount} pages")
                                            if (file.fileSize != null) append(" \u2022 ${file.fileSize / 1024}KB")
                                        }
                                        Text(
                                            text = details,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    // Cast button
                                    IconButton(
                                        onClick = { viewModel.castSavedFile(kioskId, file) },
                                    ) {
                                        Icon(
                                            Icons.Outlined.Cast,
                                            "Cast",
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(18.dp),
                                        )
                                    }
                                    // Delete button
                                    IconButton(
                                        onClick = { viewModel.deleteSavedFile(kioskId, file.id) },
                                    ) {
                                        Icon(
                                            Icons.Outlined.Delete,
                                            "Delete",
                                            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                                            modifier = Modifier.size(18.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // ═══ IPTV / Tuner Control ═══
                    SectionHeader("Tuner Control")

                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            // Channel up/down + mute
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                // Channel Down
                                FilledTonalIconButton(
                                    onClick = {
                                        viewModel.sendWidgetCommand(kioskId, "iptv", "channel-down")
                                    },
                                ) {
                                    Icon(Icons.Default.KeyboardArrowDown, "Channel Down")
                                }

                                // Mute toggle
                                FilledTonalIconButton(
                                    onClick = {
                                        viewModel.sendWidgetCommand(kioskId, "iptv", "mute-toggle")
                                    },
                                ) {
                                    Icon(Icons.Outlined.VolumeOff, "Mute")
                                }

                                // Channel Up
                                FilledTonalIconButton(
                                    onClick = {
                                        viewModel.sendWidgetCommand(kioskId, "iptv", "channel-up")
                                    },
                                ) {
                                    Icon(Icons.Default.KeyboardArrowUp, "Channel Up")
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Fullscreen modes
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                listOf("normal" to "Normal", "overlay" to "Overlay", "background" to "Background").forEach { (mode, label) ->
                                    OutlinedButton(
                                        onClick = {
                                            viewModel.sendWidgetCommand(
                                                kioskId, "iptv", "fullscreen-mode",
                                                mapOf("mode" to mode),
                                            )
                                        },
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp),
                                    ) {
                                        Text(label, style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }

                    // ═══ Multi-View ═══
                    SectionHeader("Multi-View")

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        ActionButton(
                            icon = Icons.Outlined.GridView,
                            label = "Split Screen",
                            modifier = Modifier.weight(1f),
                            onClick = { viewModel.sendCommand(kioskId, "split-screen") },
                        )
                        ActionButton(
                            icon = Icons.Outlined.CloseFullscreen,
                            label = "Exit Split",
                            modifier = Modifier.weight(1f),
                            onClick = { viewModel.sendCommand(kioskId, "exit-split-screen") },
                        )
                        ActionButton(
                            icon = Icons.Outlined.DeleteSweep,
                            label = "Clear Views",
                            modifier = Modifier.weight(1f),
                            onClick = { viewModel.sendCommand(kioskId, "multiview-clear") },
                        )
                    }

                    // ═══ Navigate to Dashboard ═══
                    if (kiosk.dashboards.isNotEmpty()) {
                        SectionHeader("Dashboards")

                        kiosk.dashboards.forEach { dashboard ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable {
                                        viewModel.sendCommand(
                                            kioskId, "navigate",
                                            mapOf("path" to dashboard.type),
                                        )
                                    },
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surface,
                                ),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(
                                        getDashboardIcon(dashboard.type),
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = dashboard.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium,
                                            color = MaterialTheme.colorScheme.onSurface,
                                        )
                                        Text(
                                            text = dashboard.type,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Icon(
                                        Icons.Outlined.OpenInNew,
                                        "Navigate",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }
    }

    // Cast webpage dialog
    if (showCastDialog) {
        AlertDialog(
            onDismissRequest = { showCastDialog = false },
            title = { Text("Cast Webpage") },
            text = {
                Column {
                    OutlinedTextField(
                        value = castUrl,
                        onValueChange = { castUrl = it },
                        placeholder = { Text("https://example.com") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Uri,
                            imeAction = ImeAction.Go,
                            autoCorrect = false,
                        ),
                        keyboardActions = KeyboardActions(
                            onGo = {
                                if (castUrl.isNotBlank()) {
                                    viewModel.sendCommand(
                                        kioskId, "display-webpage",
                                        mapOf("url" to castUrl, "navigate" to true),
                                    )
                                    castUrl = ""
                                    showCastDialog = false
                                }
                            },
                        ),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Opens the page directly on the kiosk display.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    // Embed in overlay (iframe) — for sites that allow it
                    TextButton(
                        onClick = {
                            if (castUrl.isNotBlank()) {
                                viewModel.sendCommand(
                                    kioskId, "display-webpage",
                                    mapOf("url" to castUrl),
                                )
                                castUrl = ""
                                showCastDialog = false
                            }
                        },
                    ) {
                        Text("Overlay", color = MaterialTheme.colorScheme.primary)
                    }
                    // Navigate full page — works with all sites
                    TextButton(
                        onClick = {
                            if (castUrl.isNotBlank()) {
                                viewModel.sendCommand(
                                    kioskId, "display-webpage",
                                    mapOf("url" to castUrl, "navigate" to true),
                                )
                                castUrl = ""
                                showCastDialog = false
                            }
                        },
                    ) {
                        Text("Open", color = MaterialTheme.colorScheme.primary)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showCastDialog = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun ActionButton(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Card(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                icon,
                contentDescription = label,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp),
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

private fun getDashboardIcon(type: String): ImageVector = when (type) {
    "calendar" -> Icons.Outlined.CalendarMonth
    "tasks" -> Icons.Outlined.CheckBox
    "dashboard" -> Icons.Outlined.Dashboard
    "photos" -> Icons.Outlined.PhotoLibrary
    "spotify" -> Icons.Outlined.MusicNote
    "iptv" -> Icons.Outlined.LiveTv
    "cameras" -> Icons.Outlined.Videocam
    "multiview" -> Icons.Outlined.GridView
    "homeassistant" -> Icons.Outlined.Home
    "map" -> Icons.Outlined.Map
    "kitchen" -> Icons.Outlined.Restaurant
    "chat" -> Icons.Outlined.Chat
    "screensaver" -> Icons.Outlined.Nightlight
    "weather" -> Icons.Outlined.Cloud
    else -> Icons.Outlined.Widgets
}
