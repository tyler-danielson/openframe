package us.openframe.app.ui.kiosk

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Tv
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import us.openframe.app.domain.model.Kiosk
import us.openframe.app.ui.components.EmptyState
import us.openframe.app.ui.components.ErrorState
import us.openframe.app.ui.components.LoadingState
import us.openframe.app.util.toRelativeTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KioskListScreen(
    onKioskClick: (String) -> Unit,
    viewModel: KioskViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kiosks") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        when (val state = uiState) {
            is KioskUiState.Loading -> LoadingState(Modifier.padding(padding))
            is KioskUiState.Error -> ErrorState(state.message, viewModel::refresh, Modifier.padding(padding))
            is KioskUiState.Success -> {
                if (state.kiosks.isEmpty()) {
                    EmptyState(
                        icon = Icons.Outlined.Tv,
                        title = "No kiosks",
                        subtitle = "Set up a kiosk on the web app",
                        modifier = Modifier.padding(padding),
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(state.kiosks, key = { it.id }) { kiosk ->
                            KioskCard(kiosk = kiosk, onClick = { onKioskClick(kiosk.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KioskCard(kiosk: Kiosk, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Outlined.Tv,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(32.dp),
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = kiosk.name,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "Last seen: ${kiosk.lastAccessedAt.toRelativeTime()}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Status dot
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .then(
                        Modifier.padding(0.dp) // placeholder for background
                    ),
            )

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
