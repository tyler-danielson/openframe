import Foundation

struct CompanionContext: Codable {
    let isOwner: Bool
    let permissions: CompanionPermissions?
}

struct CompanionPermissions: Codable {
    let accessCalendar: String?    // "none", "view", "edit"
    let accessTasks: String?       // "none", "view", "edit"
    let accessKiosks: Bool?
    let accessPhotos: Bool?
    let accessIptv: Bool?
    let accessHomeAssistant: Bool?
    let accessNews: Bool?
    let accessWeather: Bool?
    let accessRecipes: Bool?
    let allowedCalendarIds: [String]?
    let allowedTaskListIds: [String]?
    let allowedAlbumIds: [String]?

    var canViewCalendar: Bool { accessCalendar != nil && accessCalendar != "none" }
    var canEditCalendar: Bool { accessCalendar == "edit" }
    var canViewTasks: Bool { accessTasks != nil && accessTasks != "none" }
    var canEditTasks: Bool { accessTasks == "edit" }
    var canViewKiosks: Bool { accessKiosks ?? false }
    var canViewPhotos: Bool { accessPhotos ?? false }
    var canViewIptv: Bool { accessIptv ?? false }
    var canViewHomeAssistant: Bool { accessHomeAssistant ?? false }
    var canViewNews: Bool { accessNews ?? false }
    var canViewWeather: Bool { accessWeather ?? false }
    var canViewRecipes: Bool { accessRecipes ?? false }
}
