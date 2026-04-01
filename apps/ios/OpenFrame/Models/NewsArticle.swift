import Foundation

struct NewsHeadline: Identifiable, Codable {
    var id: String { link ?? title }
    let title: String
    var link: String?
    var url: String?
    var source: String?
    var publishedAt: String?
    var imageUrl: String?
    var description: String?
}
