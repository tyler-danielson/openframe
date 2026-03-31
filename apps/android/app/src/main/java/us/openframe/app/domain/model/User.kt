package us.openframe.app.domain.model

data class User(
    val id: String,
    val email: String,
    val name: String?,
    val avatarUrl: String?,
    val role: String?,
    val timezone: String?,
)
