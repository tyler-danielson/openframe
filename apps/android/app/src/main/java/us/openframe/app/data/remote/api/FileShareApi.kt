package us.openframe.app.data.remote.api

import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import us.openframe.app.data.remote.dto.ApiWrapper
import us.openframe.app.data.remote.dto.FileShareUploadResponse

interface FileShareApi {

    @Multipart
    @POST("/api/v1/fileshare/upload")
    suspend fun upload(@Part file: MultipartBody.Part): Response<ApiWrapper<FileShareUploadResponse>>
}
