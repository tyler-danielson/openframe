package us.openframe.app.data.remote.api

import retrofit2.Response
import retrofit2.http.*
import us.openframe.app.data.remote.dto.*

interface KioskApi {

    @GET("/api/v1/kiosks")
    suspend fun getKiosks(): Response<ApiWrapper<List<KioskDto>>>

    @GET("/api/v1/kiosks/{id}")
    suspend fun getKiosk(@Path("id") id: String): Response<ApiWrapper<KioskDto>>

    @POST("/api/v1/kiosks/{id}/command")
    suspend fun sendCommand(
        @Path("id") id: String,
        @Body request: KioskCommandRequest,
    ): Response<Any>

    @POST("/api/v1/kiosks/{id}/refresh")
    suspend fun refreshKiosk(@Path("id") id: String): Response<Any>

    // Saved files
    @GET("/api/v1/kiosks/{id}/files")
    suspend fun getSavedFiles(@Path("id") kioskId: String): Response<ApiWrapper<List<KioskSavedFileDto>>>

    @Multipart
    @POST("/api/v1/kiosks/{id}/files")
    suspend fun uploadSavedFile(
        @Path("id") kioskId: String,
        @Part file: okhttp3.MultipartBody.Part,
    ): Response<ApiWrapper<KioskSavedFileUploadResponse>>

    @DELETE("/api/v1/kiosks/{id}/files/{fileId}")
    suspend fun deleteSavedFile(
        @Path("id") kioskId: String,
        @Path("fileId") fileId: String,
    ): Response<Any>
}
