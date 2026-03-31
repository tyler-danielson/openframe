package us.openframe.app.data.remote.api

import retrofit2.Response
import retrofit2.http.*
import us.openframe.app.data.remote.dto.*

interface PhotoApi {

    @GET("/api/v1/photos/albums")
    suspend fun getAlbums(): Response<ApiWrapper<List<PhotoAlbumDto>>>

    @POST("/api/v1/photos/albums")
    suspend fun createAlbum(@Body request: CreateAlbumRequest): Response<ApiWrapper<PhotoAlbumDto>>

    @DELETE("/api/v1/photos/albums/{id}")
    suspend fun deleteAlbum(@Path("id") id: String): Response<Any>

    @GET("/api/v1/photos/albums/{id}/photos")
    suspend fun getAlbumPhotos(@Path("id") albumId: String): Response<ApiWrapper<List<PhotoDto>>>

    @Multipart
    @POST("/api/v1/photos/albums/{id}/photos")
    suspend fun uploadPhoto(
        @Path("id") albumId: String,
        @Part photo: okhttp3.MultipartBody.Part,
    ): Response<Any>

    @DELETE("/api/v1/photos/{id}")
    suspend fun deletePhoto(@Path("id") id: String): Response<Any>
}
