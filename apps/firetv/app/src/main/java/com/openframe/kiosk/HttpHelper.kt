package com.openframe.kiosk

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object HttpHelper {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json; charset=utf-8".toMediaType()

    suspend fun get(url: String): Result<JSONObject> = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder().url(url).get().build()
            val resp = client.newCall(req).execute()
            JSONObject(resp.body?.string() ?: "{}")
        }
    }

    suspend fun post(url: String, body: JSONObject = JSONObject()): Result<JSONObject> =
        withContext(Dispatchers.IO) {
            runCatching {
                val reqBody = body.toString().toRequestBody(JSON)
                val req = Request.Builder().url(url).post(reqBody).build()
                val resp = client.newCall(req).execute()
                JSONObject(resp.body?.string() ?: "{}")
            }
        }

    suspend fun healthCheck(serverUrl: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/v1/health")
                .head()
                .build()
            client.newCall(req).execute().isSuccessful
        }.getOrDefault(false)
    }
}
