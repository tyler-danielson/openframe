import Foundation

struct HAEntity: Identifiable, Codable {
    let id: String
    let entityId: String
    var displayName: String?
    var icon: String?
    var domain: String?
    var sortOrder: Int?
    var showInDashboard: Bool?
    var roomId: String?
}

struct HAEntityState: Codable {
    let entityId: String
    var state: String
    var attributes: [String: AnyCodable]?
    var lastChanged: String?
    var lastUpdated: String?

    enum CodingKeys: String, CodingKey {
        case state, attributes
        case entityId = "entity_id"
        case lastChanged = "last_changed"
        case lastUpdated = "last_updated"
    }

    var domain: String { String(entityId.prefix(while: { $0 != "." })) }
    var friendlyName: String { attributes?["friendly_name"]?.stringValue ?? entityId }
    var isToggleable: Bool { ["switch", "light", "input_boolean", "fan", "automation"].contains(domain) }
    var isOn: Bool { state == "on" }
}

struct HARoom: Identifiable, Codable {
    let id: String
    let name: String
    var sortOrder: Int?
    var temperatureSensorId: String?
    var humiditySensorId: String?
}

// Simple wrapper for heterogeneous JSON values
struct AnyCodable: Codable {
    let value: Any

    var stringValue: String? { value as? String }
    var doubleValue: Double? { value as? Double }
    var intValue: Int? { value as? Int }
    var boolValue: Bool? { value as? Bool }

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) { value = str }
        else if let num = try? container.decode(Double.self) { value = num }
        else if let bool = try? container.decode(Bool.self) { value = bool }
        else if let int = try? container.decode(Int.self) { value = int }
        else { value = "" }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let str = value as? String { try container.encode(str) }
        else if let num = value as? Double { try container.encode(num) }
        else if let bool = value as? Bool { try container.encode(bool) }
        else if let int = value as? Int { try container.encode(int) }
        else { try container.encode("") }
    }
}
