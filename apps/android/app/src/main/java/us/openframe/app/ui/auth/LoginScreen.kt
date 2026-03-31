package us.openframe.app.ui.auth

import android.accounts.AccountManager
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    serverUrl: String?,
    isSubmitting: Boolean,
    googleClientId: String?,
    onLogin: (String, String) -> Unit,
    onLoginApiKey: (String) -> Unit,
    onGoogleIdToken: (String) -> Unit,
    onOAuth: (provider: String) -> Unit,
    onScanQr: () -> Unit,
    onBack: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var apiKey by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var showApiKey by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Launches Chrome Custom Tab with the selected Google account as login_hint
    fun openGoogleOAuthWithHint(email: String?) {
        try {
            val oauthUrl = buildGoogleOAuthUrl(serverUrl, loginHint = email)
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabsIntent.launchUrl(context, Uri.parse(oauthUrl))
        } catch (e: Exception) {
            Log.w("LoginScreen", "Chrome Custom Tabs failed", e)
            onOAuth("google")
        }
    }

    // Native Android account picker → then OAuth with login_hint
    val googleAccountLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val accountName = result.data?.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)
            Log.d("LoginScreen", "Selected Google account: $accountName")
            openGoogleOAuthWithHint(accountName)
        }
    }

    fun showAccountPicker() {
        try {
            // Show the native Android Google account chooser
            @Suppress("DEPRECATION")
            val intent = AccountManager.newChooseAccountIntent(
                null,                    // selectedAccount
                null,                    // allowableAccounts
                arrayOf("com.google"),   // allowableAccountTypes — Google accounts only
                null,                    // descriptionOverrideText
                null,                    // addAccountAuthTokenType
                null,                    // addAccountRequiredFeatures
                null,                    // addAccountOptions
            )
            googleAccountLauncher.launch(intent)
        } catch (e: Exception) {
            Log.w("LoginScreen", "Account picker failed, going direct", e)
            openGoogleOAuthWithHint(null)
        }
    }

    fun launchGoogleSignIn() {
        // Go straight to Chrome Custom Tabs — Google's browser account chooser
        // is the best UX (shows all accounts the user is signed into in Chrome)
        openGoogleOAuthWithHint(null)
    }

    fun launchMicrosoftSignIn() {
        try {
            val oauthUrl = buildMicrosoftOAuthUrl(serverUrl)
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabsIntent.launchUrl(context, Uri.parse(oauthUrl))
        } catch (e: Exception) {
            Log.w("LoginScreen", "Chrome Custom Tabs failed for Microsoft", e)
            onOAuth("microsoft")
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        TopAppBar(
            title = { Text("Sign In") },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.background,
                titleContentColor = MaterialTheme.colorScheme.onBackground,
            ),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Server info
            if (serverUrl != null) {
                Text(
                    text = serverUrl,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(24.dp))
            }

            // ═══ OAuth buttons ═══
            OutlinedButton(
                onClick = { launchGoogleSignIn() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                border = ButtonDefaults.outlinedButtonBorder(true),
            ) {
                Text(
                    "G",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    "Continue with Google",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedButton(
                onClick = { launchMicrosoftSignIn() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                border = ButtonDefaults.outlinedButtonBorder(true),
            ) {
                Text(
                    "M",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    "Continue with Microsoft",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Divider
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                )
                Text(
                    text = "  or sign in with email  ",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            if (!showApiKey) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                    ),
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    visualTransformation = if (showPassword) VisualTransformation.None
                        else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                if (showPassword) Icons.Default.VisibilityOff
                                else Icons.Default.Visibility,
                                "Toggle password",
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Go,
                    ),
                    keyboardActions = KeyboardActions(
                        onGo = {
                            if (email.isNotBlank() && password.isNotBlank()) {
                                onLogin(email, password)
                            }
                        },
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                    ),
                )

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = { onLogin(email, password) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = email.isNotBlank() && password.isNotBlank() && !isSubmitting,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                    ),
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("Sign In")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    TextButton(onClick = onScanQr) {
                        Text("Scan QR", color = MaterialTheme.colorScheme.primary)
                    }
                    TextButton(onClick = { showApiKey = true }) {
                        Icon(
                            Icons.Default.Key,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Use API Key", color = MaterialTheme.colorScheme.primary)
                    }
                }
            } else {
                OutlinedTextField(
                    value = apiKey,
                    onValueChange = { apiKey = it },
                    label = { Text("API Key") },
                    placeholder = { Text("openframe_xxx_yyy") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(
                        onGo = { if (apiKey.isNotBlank()) onLoginApiKey(apiKey) },
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                    ),
                )

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = { onLoginApiKey(apiKey) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = apiKey.isNotBlank() && !isSubmitting,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                    ),
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("Connect with API Key")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                TextButton(onClick = { showApiKey = false }) {
                    Text("Use email instead", color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

/** Build Google OAuth URL with a callback that returns to the app */
private fun buildGoogleOAuthUrl(serverUrl: String?, loginHint: String? = null): String {
    val base = serverUrl ?: "https://openframe.us"
    val callbackUrl = "openframe://auth/callback"
    val url = StringBuilder("$base/api/v1/auth/oauth/google?callbackUrl=${java.net.URLEncoder.encode(callbackUrl, "UTF-8")}")
    // Tell server this is a mobile app — use select_account prompt instead of consent
    url.append("&mobile=true")
    if (!loginHint.isNullOrBlank()) {
        url.append("&login_hint=${java.net.URLEncoder.encode(loginHint, "UTF-8")}")
    }
    return url.toString()
}

private fun buildMicrosoftOAuthUrl(serverUrl: String?): String {
    val base = serverUrl ?: "https://openframe.us"
    val callbackUrl = "openframe://auth/callback"
    return "$base/api/v1/auth/oauth/microsoft?callbackUrl=${java.net.URLEncoder.encode(callbackUrl, "UTF-8")}"
}
