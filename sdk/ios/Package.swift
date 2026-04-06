// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OpenStoryiOS",
    platforms: [
        .iOS(.v15),
        .macOS(.v13),
    ],
    products: [
        .library(
            name: "OpenStorySDK",
            targets: ["OpenStorySDK"]
        ),
    ],
    targets: [
        .target(
            name: "OpenStorySDK",
            path: "Sources/OpenStorySDK",
            linkerSettings: [
                .linkedLibrary("sqlite3"),
            ]
        ),
        .testTarget(
            name: "OpenStorySDKTests",
            dependencies: ["OpenStorySDK"]
        ),
    ]
)
