import Foundation

internal struct AppVersionProvider {
    func versionName() -> String {
        let value = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "0.0.0" : trimmed
    }
}
