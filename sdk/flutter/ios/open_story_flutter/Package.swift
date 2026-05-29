// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "open_story_flutter",
    platforms: [
        .iOS("15.0"),
    ],
    products: [
        .library(name: "open-story-flutter", targets: ["open_story_flutter"]),
    ],
    dependencies: [
        .package(name: "FlutterFramework", path: "../FlutterFramework"),
    ],
    targets: [
        .target(
            name: "open_story_flutter",
            dependencies: [
                .product(name: "FlutterFramework", package: "FlutterFramework"),
            ],
            linkerSettings: [
                .linkedLibrary("sqlite3"),
            ]
        ),
    ]
)
