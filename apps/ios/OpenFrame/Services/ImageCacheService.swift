import Foundation
import Kingfisher

enum ImageCacheService {
    /// Configure Kingfisher image cache with app-appropriate defaults.
    /// Call once at app launch.
    static func configure() {
        let cache = ImageCache.default

        // Memory: 100MB limit, 5 min expiration
        cache.memoryStorage.config.totalCostLimit = 100 * 1024 * 1024
        cache.memoryStorage.config.expiration = .seconds(300)

        // Disk: 500MB limit, 7 day expiration
        cache.diskStorage.config.sizeLimit = 500 * 1024 * 1024
        cache.diskStorage.config.expiration = .days(7)

        // Downloader timeout
        let downloader = ImageDownloader.default
        downloader.downloadTimeout = 30
    }

    /// Build a Kingfisher modifier that injects auth headers for
    /// loading images from the OpenFrame API (e.g. photos).
    static func authModifier(keychainService: KeychainService) -> AnyModifier {
        AnyModifier { request in
            var req = request
            if keychainService.authMethod == .bearer, let token = keychainService.accessToken {
                req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            } else if keychainService.authMethod == .apiKey, let key = keychainService.apiKey {
                req.setValue(key, forHTTPHeaderField: "X-API-Key")
            }
            return req
        }
    }

    /// Clear all cached images (memory + disk).
    static func clearCache() {
        ImageCache.default.clearMemoryCache()
        ImageCache.default.clearDiskCache()
    }
}
