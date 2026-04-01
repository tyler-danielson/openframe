import Foundation
import Alamofire

enum APIRouter: URLRequestConvertible {

    // MARK: - Auth
    case healthCheck
    case authConfig
    case login(email: String, password: String)
    case signup(name: String, email: String, password: String)
    case refreshToken(token: String)
    case logout(refreshToken: String)
    case getCurrentUser
    case oauthStart(provider: String, callbackUrl: String)

    // MARK: - Companion
    case getCompanionContext
    case getCompanionInvites
    case createCompanionInvite(label: String?)
    case deleteCompanionInvite(id: String)
    case acceptCompanionInvite(token: String, email: String, name: String?, password: String)

    // MARK: - Calendars
    case getCalendars
    case getEvents(start: String, end: String, calendarIds: [String]?)
    case getEvent(id: String)
    case createEvent(body: [String: Any])
    case updateEvent(id: String, body: [String: Any])
    case deleteEvent(id: String)

    // MARK: - Tasks
    case getTaskLists
    case getTasks(listId: String?, status: String?)
    case createTask(body: [String: Any])
    case updateTask(id: String, body: [String: Any])
    case completeTask(id: String)
    case deleteTask(id: String)

    // MARK: - Photos
    case getAlbums
    case getAlbumPhotos(albumId: String)
    case deletePhoto(id: String)

    // MARK: - Kiosks
    case getKiosks
    case getKiosk(id: String)
    case sendKioskCommand(kioskId: String, type: String, payload: [String: String]?)
    case getKioskFiles(kioskId: String)
    case deleteKioskFile(kioskId: String, fileId: String)

    // MARK: - Recipes
    case getRecipes(search: String?, tags: String?)
    case getRecipe(id: String)
    case createRecipe(body: [String: Any])
    case updateRecipe(id: String, body: [String: Any])
    case deleteRecipe(id: String)
    case scanRecipe(imageUrl: String)
    case getRecipeTags

    // MARK: - Weather
    case getCurrentWeather
    case getWeatherForecast

    // MARK: - News
    case getNewsHeadlines(limit: Int?)

    // MARK: - Home Assistant
    case getHAConfig
    case getHAEntities(domain: String?)
    case getHARooms
    case callHAService(domain: String, service: String, entityId: String?, data: [String: Any]?)

    // MARK: - IPTV
    case getIptvChannels(group: String?, search: String?)
    case getIptvCategories
    case getIptvFavorites

    // MARK: - Push
    case registerPushToken(body: [String: String])
    case unregisterPushToken(deviceId: String)

    // MARK: - Settings
    case getUserSettings
    case updateUserSettings(body: [String: Any])
    case getSettingsCategory(category: String)

    // MARK: - URL Building

    var method: HTTPMethod {
        switch self {
        case .healthCheck, .authConfig, .getCurrentUser, .getCompanionContext,
             .getCompanionInvites, .getCalendars, .getEvents, .getEvent,
             .getTaskLists, .getTasks, .getAlbums, .getAlbumPhotos,
             .getKiosks, .getKiosk, .getKioskFiles,
             .getRecipes, .getRecipe, .getRecipeTags,
             .getCurrentWeather, .getWeatherForecast,
             .getNewsHeadlines, .getHAConfig, .getHAEntities, .getHARooms,
             .getIptvChannels, .getIptvCategories, .getIptvFavorites,
             .getUserSettings, .getSettingsCategory,
             .oauthStart:
            return .get

        case .login, .signup, .refreshToken, .logout,
             .createCompanionInvite, .acceptCompanionInvite,
             .createEvent, .createTask, .completeTask,
             .sendKioskCommand, .createRecipe, .scanRecipe,
             .callHAService, .registerPushToken:
            return .post

        case .updateEvent, .updateTask, .updateRecipe, .updateUserSettings:
            return .patch

        case .deleteEvent, .deleteTask, .deletePhoto, .deleteKioskFile,
             .deleteRecipe, .deleteCompanionInvite, .unregisterPushToken:
            return .delete
        }
    }

    var path: String {
        switch self {
        case .healthCheck: return "/api/v1/health"
        case .authConfig: return "/api/v1/auth/config"
        case .login: return "/api/v1/auth/login"
        case .signup: return "/api/v1/auth/signup"
        case .refreshToken: return "/api/v1/auth/refresh"
        case .logout: return "/api/v1/auth/logout"
        case .getCurrentUser: return "/api/v1/auth/me"
        case .oauthStart(let provider, _): return "/api/v1/auth/oauth/\(provider)"

        case .getCompanionContext: return "/api/v1/companion/access/me"
        case .getCompanionInvites: return "/api/v1/companion-invites"
        case .createCompanionInvite: return "/api/v1/companion-invites"
        case .deleteCompanionInvite(let id): return "/api/v1/companion-invites/\(id)"
        case .acceptCompanionInvite(let token, _, _, _): return "/api/v1/companion-invites/token/\(token)/accept"

        case .getCalendars: return "/api/v1/companion/data/calendars"
        case .getEvents: return "/api/v1/companion/data/events"
        case .getEvent(let id): return "/api/v1/companion/data/events/\(id)"
        case .createEvent: return "/api/v1/companion/data/events"
        case .updateEvent(let id, _): return "/api/v1/companion/data/events/\(id)"
        case .deleteEvent(let id): return "/api/v1/companion/data/events/\(id)"

        case .getTaskLists: return "/api/v1/companion/data/task-lists"
        case .getTasks: return "/api/v1/companion/data/tasks"
        case .createTask: return "/api/v1/companion/data/tasks"
        case .updateTask(let id, _): return "/api/v1/companion/data/tasks/\(id)"
        case .completeTask(let id): return "/api/v1/tasks/\(id)/complete"
        case .deleteTask(let id): return "/api/v1/companion/data/tasks/\(id)"

        case .getAlbums: return "/api/v1/companion/data/albums"
        case .getAlbumPhotos(let albumId): return "/api/v1/companion/data/albums/\(albumId)/photos"
        case .deletePhoto(let id): return "/api/v1/photos/\(id)"

        case .getKiosks: return "/api/v1/kiosks"
        case .getKiosk(let id): return "/api/v1/kiosks/\(id)"
        case .sendKioskCommand(let id, _, _): return "/api/v1/kiosks/\(id)/commands"
        case .getKioskFiles(let id): return "/api/v1/kiosks/\(id)/files"
        case .deleteKioskFile(let kioskId, let fileId): return "/api/v1/kiosks/\(kioskId)/files/\(fileId)"

        case .getRecipes: return "/api/v1/recipes"
        case .getRecipe(let id): return "/api/v1/recipes/\(id)"
        case .createRecipe: return "/api/v1/recipes"
        case .updateRecipe(let id, _): return "/api/v1/recipes/\(id)"
        case .deleteRecipe(let id): return "/api/v1/recipes/\(id)"
        case .scanRecipe: return "/api/v1/recipes/scan"
        case .getRecipeTags: return "/api/v1/recipes/tags"

        case .getCurrentWeather: return "/api/v1/weather/current"
        case .getWeatherForecast: return "/api/v1/weather/forecast"

        case .getNewsHeadlines: return "/api/v1/news/headlines"

        case .getHAConfig: return "/api/v1/homeassistant/config"
        case .getHAEntities: return "/api/v1/homeassistant/entities"
        case .getHARooms: return "/api/v1/homeassistant/rooms"
        case .callHAService(let domain, let service, _, _): return "/api/v1/homeassistant/services/\(domain)/\(service)"

        case .getIptvChannels: return "/api/v1/iptv/channels"
        case .getIptvCategories: return "/api/v1/iptv/categories"
        case .getIptvFavorites: return "/api/v1/iptv/favorites"

        case .registerPushToken: return "/api/v1/push/register"
        case .unregisterPushToken(let deviceId): return "/api/v1/push/register/\(deviceId)"

        case .getUserSettings: return "/api/v1/settings"
        case .updateUserSettings: return "/api/v1/settings"
        case .getSettingsCategory(let cat): return "/api/v1/settings/\(cat)"
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
        case .getEvents(let start, let end, let calendarIds):
            var items = [URLQueryItem(name: "start", value: start), URLQueryItem(name: "end", value: end)]
            if let ids = calendarIds {
                items.append(URLQueryItem(name: "calendarIds", value: ids.joined(separator: ",")))
            }
            return items
        case .getTasks(let listId, let status):
            var items: [URLQueryItem] = []
            if let listId { items.append(URLQueryItem(name: "listId", value: listId)) }
            if let status { items.append(URLQueryItem(name: "status", value: status)) }
            return items.isEmpty ? nil : items
        case .getRecipes(let search, let tags):
            var items: [URLQueryItem] = []
            if let search { items.append(URLQueryItem(name: "search", value: search)) }
            if let tags { items.append(URLQueryItem(name: "tags", value: tags)) }
            return items.isEmpty ? nil : items
        case .getNewsHeadlines(let limit):
            if let limit { return [URLQueryItem(name: "limit", value: "\(limit)")] }
            return nil
        case .getHAEntities(let domain):
            if let domain { return [URLQueryItem(name: "domain", value: domain)] }
            return nil
        case .getIptvChannels(let group, let search):
            var items: [URLQueryItem] = []
            if let group { items.append(URLQueryItem(name: "group", value: group)) }
            if let search { items.append(URLQueryItem(name: "search", value: search)) }
            return items.isEmpty ? nil : items
        case .oauthStart(_, let callbackUrl):
            return [
                URLQueryItem(name: "callbackUrl", value: callbackUrl),
                URLQueryItem(name: "mobile", value: "true"),
            ]
        default:
            return nil
        }
    }

    var body: [String: Any]? {
        switch self {
        case .login(let email, let password):
            return ["email": email, "password": password]
        case .signup(let name, let email, let password):
            return ["name": name, "email": email, "password": password]
        case .refreshToken(let token):
            return ["refreshToken": token]
        case .logout(let refreshToken):
            return ["refreshToken": refreshToken]
        case .createCompanionInvite(let label):
            return label != nil ? ["label": label!] : [:]
        case .acceptCompanionInvite(_, let email, let name, let password):
            var dict: [String: Any] = ["email": email, "password": password]
            if let name { dict["name"] = name }
            return dict
        case .createEvent(let body), .updateEvent(_, let body),
             .createTask(let body), .updateTask(_, let body),
             .createRecipe(let body), .updateRecipe(_, let body),
             .updateUserSettings(let body):
            return body
        case .sendKioskCommand(_, let type, let payload):
            var dict: [String: Any] = ["type": type]
            if let payload { dict["payload"] = payload }
            return dict
        case .scanRecipe(let imageUrl):
            return ["imageUrl": imageUrl]
        case .callHAService(_, _, let entityId, let data):
            var dict: [String: Any] = [:]
            if let entityId { dict["entity_id"] = entityId }
            if let data { dict.merge(data) { _, new in new } }
            return dict
        case .registerPushToken(let body):
            return body as [String: Any]
        case .completeTask:
            return [:]
        default:
            return nil
        }
    }

    // MARK: - URLRequestConvertible

    func asURLRequest() throws -> URLRequest {
        // The base URL is injected by the APIClient at request time
        let url = try "placeholder".asURL().appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.method = method

        if let queryItems {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems
            request.url = components.url
        }

        if let body, method != .get {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return request
    }
}
