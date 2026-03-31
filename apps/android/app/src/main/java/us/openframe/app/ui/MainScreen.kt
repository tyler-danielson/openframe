package us.openframe.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import us.openframe.app.data.local.DataStoreManager
import us.openframe.app.data.local.TokenManager
import us.openframe.app.ui.calendar.CalendarScreen
import us.openframe.app.ui.components.WebViewScreen
import us.openframe.app.ui.kiosk.KioskListScreen
import us.openframe.app.ui.more.MoreScreen
import us.openframe.app.ui.photos.PhotosScreen
import us.openframe.app.ui.recipes.*
import us.openframe.app.ui.settings.SettingsScreen
import us.openframe.app.ui.tasks.TasksScreen
import us.openframe.app.ui.today.TodayScreen

/**
 * All available screens in the app. Each can be pinned to the bottom toolbar.
 */
enum class AppScreen(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
) {
    TODAY("today", "Today", Icons.Filled.Today, Icons.Outlined.Today),
    CALENDAR("calendar", "Calendar", Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth),
    TASKS("tasks", "Tasks", Icons.Filled.CheckBox, Icons.Outlined.CheckBoxOutlineBlank),
    PHOTOS("photos", "Photos", Icons.Filled.PhotoLibrary, Icons.Outlined.PhotoLibrary),
    KIOSK("kiosk", "Kiosk", Icons.Filled.Tv, Icons.Outlined.Tv),
    SETTINGS("settings", "Settings", Icons.Filled.Settings, Icons.Outlined.Settings),
    DASHBOARD("dashboard", "Dashboard", Icons.Filled.Dashboard, Icons.Outlined.Dashboard),
    SPOTIFY("spotify", "Spotify", Icons.Filled.MusicNote, Icons.Outlined.MusicNote),
    LIVE_TV("livetv", "Live TV", Icons.Filled.LiveTv, Icons.Outlined.LiveTv),
    RECIPES("recipes", "Recipes", Icons.Filled.Restaurant, Icons.Outlined.Restaurant),
    HOME_ASSISTANT("homeassistant", "Home Assistant", Icons.Filled.Home, Icons.Outlined.Home),
    CAMERAS("cameras", "Cameras", Icons.Filled.Videocam, Icons.Outlined.Videocam),
    MULTI_VIEW("multiview", "Multi-View", Icons.Filled.GridView, Icons.Outlined.GridView),
    NEWS("news", "News", Icons.Filled.Newspaper, Icons.Outlined.Newspaper),
    WEATHER("weather", "Weather", Icons.Filled.Cloud, Icons.Outlined.Cloud),
    CHAT("chat", "Chat", Icons.Filled.Chat, Icons.Outlined.Chat),
    MAP("map", "Map", Icons.Filled.Map, Icons.Outlined.Map),
    FILES("files", "Files", Icons.Filled.Folder, Icons.Outlined.Folder),
    ROUTINES("routines", "Routines", Icons.Filled.PlaylistPlay, Icons.Outlined.PlaylistPlay),
    PROFILES("profiles", "Profiles", Icons.Filled.People, Icons.Outlined.People),
    REMARKABLE("remarkable", "reMarkable", Icons.Filled.Draw, Icons.Outlined.Draw),
    CARD_VIEW("cardview", "Card View", Icons.Filled.ViewKanban, Icons.Outlined.ViewKanban),
    MATTER("matter", "Matter", Icons.Filled.Memory, Icons.Outlined.Memory);

    companion object {
        fun fromRoute(route: String): AppScreen? = entries.find { it.route == route }
        val DEFAULT_PINNED = listOf("today", "calendar", "photos", "kiosk")
    }
}

@Composable
fun MainScreen(
    dataStoreManager: DataStoreManager,
    tokenManager: TokenManager,
    onNavigateToEvent: (String) -> Unit,
    onNavigateToNewEvent: () -> Unit,
    onNavigateToAlbum: (String) -> Unit,
    onNavigateToKiosk: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val tabNavController = rememberNavController()
    val navBackStackEntry by tabNavController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val pinnedRoutes by dataStoreManager.pinnedTabs.collectAsState(initial = AppScreen.DEFAULT_PINNED)

    // Resolve pinned tabs from routes, preserving order
    val pinnedTabs = pinnedRoutes.mapNotNull { AppScreen.fromRoute(it) }.take(4)

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ) {
                // Pinned tabs
                pinnedTabs.forEach { tab ->
                    val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            tabNavController.navigate(tab.route) {
                                popUpTo(tabNavController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            Icon(
                                if (selected) tab.selectedIcon else tab.unselectedIcon,
                                contentDescription = tab.label,
                            )
                        },
                        label = { Text(tab.label, style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        ),
                    )
                }

                // "More" tab (always last)
                val moreSelected = currentDestination?.route == "more"
                    || (currentDestination?.route != null
                    && pinnedTabs.none { it.route == currentDestination.route })
                NavigationBarItem(
                    selected = moreSelected,
                    onClick = {
                        tabNavController.navigate("more") {
                            popUpTo(tabNavController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    icon = {
                        Icon(
                            if (moreSelected) Icons.Filled.MoreHoriz else Icons.Outlined.MoreHoriz,
                            contentDescription = "More",
                        )
                    },
                    label = { Text("More", style = MaterialTheme.typography.labelSmall) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.primary,
                        selectedTextColor = MaterialTheme.colorScheme.primary,
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                    ),
                )
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        NavHost(
            navController = tabNavController,
            startDestination = pinnedTabs.firstOrNull()?.route ?: "today",
            modifier = Modifier.padding(innerPadding),
        ) {
            // More screen
            composable("more") {
                MoreScreen(
                    onNavigate = { route ->
                        tabNavController.navigate(route) {
                            popUpTo(tabNavController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }

            // All app screens (registered regardless of pin state)
            composable(AppScreen.TODAY.route) {
                TodayScreen(onEventClick = onNavigateToEvent, onAddEvent = onNavigateToNewEvent)
            }
            composable(AppScreen.CALENDAR.route) {
                CalendarScreen(onEventClick = onNavigateToEvent, onAddEvent = onNavigateToNewEvent)
            }
            composable(AppScreen.TASKS.route) {
                TasksScreen()
            }
            composable(AppScreen.PHOTOS.route) {
                PhotosScreen(onAlbumClick = onNavigateToAlbum)
            }
            composable(AppScreen.KIOSK.route) {
                KioskListScreen(onKioskClick = onNavigateToKiosk)
            }
            composable(AppScreen.SETTINGS.route) {
                SettingsScreen(onLogout = onLogout)
            }
            // Web-backed screens (loaded from OpenFrame web app)
            composable(AppScreen.DASHBOARD.route) {
                WebViewScreen(tokenManager, "dashboard")
            }
            composable(AppScreen.SPOTIFY.route) {
                WebViewScreen(tokenManager, "spotify")
            }
            composable(AppScreen.LIVE_TV.route) {
                WebViewScreen(tokenManager, "iptv")
            }
            composable(AppScreen.RECIPES.route) {
                val recipesViewModel: RecipesViewModel = androidx.hilt.navigation.compose.hiltViewModel()
                RecipesScreen(
                    viewModel = recipesViewModel,
                    onRecipeClick = { id -> tabNavController.navigate("recipe/$id") },
                    onAddManual = { tabNavController.navigate("recipe/add") },
                    onScanRecipe = { tabNavController.navigate("recipe/scan") },
                )
            }
            composable("recipe/{recipeId}") { backStackEntry ->
                val recipeId = backStackEntry.arguments?.getString("recipeId") ?: return@composable
                val recipesViewModel: RecipesViewModel = androidx.hilt.navigation.compose.hiltViewModel()
                RecipeDetailScreen(
                    viewModel = recipesViewModel,
                    recipeId = recipeId,
                    onBack = { tabNavController.popBackStack() },
                )
            }
            composable("recipe/add") {
                val recipesViewModel: RecipesViewModel = androidx.hilt.navigation.compose.hiltViewModel()
                AddRecipeScreen(
                    viewModel = recipesViewModel,
                    onBack = { tabNavController.popBackStack() },
                    onRecipeCreated = { id ->
                        tabNavController.popBackStack()
                        tabNavController.navigate("recipe/$id")
                    },
                )
            }
            composable("recipe/scan") {
                val recipesViewModel: RecipesViewModel = androidx.hilt.navigation.compose.hiltViewModel()
                ScanRecipeScreen(
                    viewModel = recipesViewModel,
                    onBack = { tabNavController.popBackStack() },
                    onRecipeCreated = { id ->
                        tabNavController.popBackStack()
                        tabNavController.navigate("recipe/$id")
                    },
                )
            }
            composable(AppScreen.HOME_ASSISTANT.route) {
                WebViewScreen(tokenManager, "homeassistant")
            }
            composable(AppScreen.CAMERAS.route) {
                WebViewScreen(tokenManager, "cameras")
            }
            composable(AppScreen.MULTI_VIEW.route) {
                WebViewScreen(tokenManager, "multiview")
            }
            composable(AppScreen.NEWS.route) {
                WebViewScreen(tokenManager, "companion/more/news")
            }
            composable(AppScreen.WEATHER.route) {
                WebViewScreen(tokenManager, "companion/more/weather")
            }
            composable(AppScreen.CHAT.route) {
                WebViewScreen(tokenManager, "chat")
            }
            composable(AppScreen.MAP.route) {
                WebViewScreen(tokenManager, "map")
            }
            composable(AppScreen.FILES.route) {
                WebViewScreen(tokenManager, "files")
            }
            composable(AppScreen.ROUTINES.route) {
                WebViewScreen(tokenManager, "routines")
            }
            composable(AppScreen.PROFILES.route) {
                WebViewScreen(tokenManager, "profiles")
            }
            composable(AppScreen.REMARKABLE.route) {
                WebViewScreen(tokenManager, "remarkable")
            }
            composable(AppScreen.CARD_VIEW.route) {
                WebViewScreen(tokenManager, "cardview")
            }
            composable(AppScreen.MATTER.route) {
                WebViewScreen(tokenManager, "matter")
            }
        }
    }
}

