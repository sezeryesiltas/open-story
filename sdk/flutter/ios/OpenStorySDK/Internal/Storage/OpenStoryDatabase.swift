import Foundation
import SQLite3

internal struct StoryFeedSnapshotRecord: Equatable, Sendable {
    let cacheKey: String
    let placementKey: String
    let platform: String
    let appVersion: String
    let userSegmentsHash: String
    let payloadJSON: String
    let updatedAtEpochMs: Int64
}

internal final class OpenStoryDatabase: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.openstory.sdk.sqlite")
    private let databaseURL: URL
    private var database: OpaquePointer?

    init(databaseURL: URL = OpenStoryDatabase.defaultDatabaseURL()) throws {
        self.databaseURL = databaseURL
        try FileManager.default.createDirectory(
            at: databaseURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: nil
        )
        try open()
        try createTables()
    }

    deinit {
        if let database {
            sqlite3_close(database)
        }
    }

    func findFeedSnapshot(cacheKey: String) -> StoryFeedSnapshotRecord? {
        queue.sync {
            guard let database else {
                return nil
            }

            let sql = """
            SELECT cache_key, placement_key, platform, app_version, user_segments_hash, payload_json, updated_at_epoch_ms
            FROM story_feed_snapshot
            WHERE cache_key = ?
            LIMIT 1;
            """
            guard let statement = prepareStatement(sql, database: database) else {
                return nil
            }
            defer { sqlite3_finalize(statement) }

            bindText(cacheKey, at: 1, in: statement)

            guard sqlite3_step(statement) == SQLITE_ROW else {
                return nil
            }

            return StoryFeedSnapshotRecord(
                cacheKey: readText(at: 0, from: statement),
                placementKey: readText(at: 1, from: statement),
                platform: readText(at: 2, from: statement),
                appVersion: readText(at: 3, from: statement),
                userSegmentsHash: readText(at: 4, from: statement),
                payloadJSON: readText(at: 5, from: statement),
                updatedAtEpochMs: sqlite3_column_int64(statement, 6)
            )
        }
    }

    func upsertFeedSnapshot(_ record: StoryFeedSnapshotRecord) throws {
        try queue.sync {
            guard let database else {
                throw SQLiteError.unavailable
            }

            let sql = """
            INSERT INTO story_feed_snapshot (
                cache_key,
                placement_key,
                platform,
                app_version,
                user_segments_hash,
                payload_json,
                updated_at_epoch_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                placement_key = excluded.placement_key,
                platform = excluded.platform,
                app_version = excluded.app_version,
                user_segments_hash = excluded.user_segments_hash,
                payload_json = excluded.payload_json,
                updated_at_epoch_ms = excluded.updated_at_epoch_ms;
            """

            guard let statement = prepareStatement(sql, database: database) else {
                throw lastError(database: database)
            }
            defer { sqlite3_finalize(statement) }

            bindText(record.cacheKey, at: 1, in: statement)
            bindText(record.placementKey, at: 2, in: statement)
            bindText(record.platform, at: 3, in: statement)
            bindText(record.appVersion, at: 4, in: statement)
            bindText(record.userSegmentsHash, at: 5, in: statement)
            bindText(record.payloadJSON, at: 6, in: statement)
            sqlite3_bind_int64(statement, 7, record.updatedAtEpochMs)

            guard sqlite3_step(statement) == SQLITE_DONE else {
                throw lastError(database: database)
            }
        }
    }

    func deleteFeedSnapshot(cacheKey: String) throws {
        try queue.sync {
            guard let database else {
                throw SQLiteError.unavailable
            }

            let sql = "DELETE FROM story_feed_snapshot WHERE cache_key = ?;"
            guard let statement = prepareStatement(sql, database: database) else {
                throw lastError(database: database)
            }
            defer { sqlite3_finalize(statement) }

            bindText(cacheKey, at: 1, in: statement)
            guard sqlite3_step(statement) == SQLITE_DONE else {
                throw lastError(database: database)
            }
        }
    }

    func allViewedStoryRevisionIds() -> [String] {
        queue.sync {
            guard let database else {
                return []
            }

            let sql = """
            SELECT story_revision_id
            FROM viewed_story_revision
            ORDER BY first_viewed_at_epoch_ms ASC;
            """
            guard let statement = prepareStatement(sql, database: database) else {
                return []
            }
            defer { sqlite3_finalize(statement) }

            var values: [String] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                values.append(readText(at: 0, from: statement))
            }
            return values
        }
    }

    func upsertViewedStoryRevision(
        storyRevisionId: String,
        firstViewedAtEpochMs: Int64
    ) throws {
        try queue.sync {
            guard let database else {
                throw SQLiteError.unavailable
            }

            let sql = """
            INSERT INTO viewed_story_revision (
                story_revision_id,
                first_viewed_at_epoch_ms
            ) VALUES (?, ?)
            ON CONFLICT(story_revision_id) DO NOTHING;
            """

            guard let statement = prepareStatement(sql, database: database) else {
                throw lastError(database: database)
            }
            defer { sqlite3_finalize(statement) }

            bindText(storyRevisionId, at: 1, in: statement)
            sqlite3_bind_int64(statement, 2, firstViewedAtEpochMs)

            guard sqlite3_step(statement) == SQLITE_DONE else {
                throw lastError(database: database)
            }
        }
    }

    static func defaultDatabaseURL() -> URL {
        let baseURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        return baseURL
            .appendingPathComponent("open-story", isDirectory: true)
            .appendingPathComponent("open-story-ios-sdk.sqlite", isDirectory: false)
    }

    private func open() throws {
        var handle: OpaquePointer?
        if sqlite3_open_v2(
            databaseURL.path,
            &handle,
            SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
            nil
        ) != SQLITE_OK {
            throw lastError(database: handle)
        }
        database = handle
    }

    private func createTables() throws {
        try execute("""
        CREATE TABLE IF NOT EXISTS story_feed_snapshot (
            cache_key TEXT PRIMARY KEY,
            placement_key TEXT NOT NULL,
            platform TEXT NOT NULL,
            app_version TEXT NOT NULL,
            user_segments_hash TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            updated_at_epoch_ms INTEGER NOT NULL
        );
        """)

        try execute("""
        CREATE TABLE IF NOT EXISTS viewed_story_revision (
            story_revision_id TEXT PRIMARY KEY,
            first_viewed_at_epoch_ms INTEGER NOT NULL
        );
        """)
    }

    private func execute(_ sql: String) throws {
        guard let database else {
            throw SQLiteError.unavailable
        }

        var errorMessage: UnsafeMutablePointer<Int8>?
        guard sqlite3_exec(database, sql, nil, nil, &errorMessage) == SQLITE_OK else {
            let message = errorMessage.map { String(cString: $0) } ?? "Unknown SQLite error."
            sqlite3_free(errorMessage)
            throw SQLiteError.message(message)
        }
    }

    private func prepareStatement(
        _ sql: String,
        database: OpaquePointer
    ) -> OpaquePointer? {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
            return nil
        }
        return statement
    }

    private func readText(
        at index: Int32,
        from statement: OpaquePointer?
    ) -> String {
        guard let rawValue = sqlite3_column_text(statement, index) else {
            return ""
        }
        return String(cString: rawValue)
    }

    private func lastError(database: OpaquePointer?) -> SQLiteError {
        let message = sqlite3_errmsg(database).map(String.init(cString:)) ?? "Unknown SQLite error."
        return .message(message)
    }

    private func bindText(
        _ value: String,
        at index: Int32,
        in statement: OpaquePointer?
    ) {
        sqlite3_bind_text(statement, index, (value as NSString).utf8String, -1, transientDestructor)
    }

    private let transientDestructor = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
}

internal enum SQLiteError: Error, Equatable {
    case unavailable
    case message(String)
}
