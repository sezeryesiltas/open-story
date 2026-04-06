@testable import OpenStorySDK

import Testing

@Test
func firstUnviewedStoryIndexReturnsFirstUnviewedStory() {
    let group = makeStoryGroup(
        revisions: ["story-rev-1", "story-rev-2", "story-rev-3"]
    )
    let snapshot = ViewedStoryStateSnapshot(
        viewedStoryRevisionIds: ["story-rev-1"]
    )

    #expect(snapshot.firstUnviewedStoryIndex(in: group) == 1)
    #expect(snapshot.isGroupViewed(group) == false)
}

@Test
func firstUnviewedStoryIndexFallsBackToFirstStoryWhenGroupIsFullyViewed() {
    let group = makeStoryGroup(
        revisions: ["story-rev-1", "story-rev-2"]
    )
    let snapshot = ViewedStoryStateSnapshot(
        viewedStoryRevisionIds: ["story-rev-1", "story-rev-2"]
    )

    #expect(snapshot.firstUnviewedStoryIndex(in: group) == 0)
    #expect(snapshot.isGroupViewed(group) == true)
}

@Test
func viewedStorySessionPromotesGroupToViewedAfterLastStoryStarts() {
    let group = makeStoryGroup(
        revisions: ["story-rev-1", "story-rev-2"]
    )
    var markedRevisionIds: [String] = []
    let session = ViewedStorySession(
        initialSnapshot: ViewedStoryStateSnapshot(
            viewedStoryRevisionIds: ["story-rev-1"]
        ),
        onStoryViewed: { storyRevisionId in
            markedRevisionIds.append(storyRevisionId)
        }
    )

    #expect(session.firstUnviewedStoryIndex(in: group) == 1)
    #expect(session.isGroupViewed(group) == false)

    session.markStoryViewed("story-rev-2")

    #expect(markedRevisionIds == ["story-rev-2"])
    #expect(session.firstUnviewedStoryIndex(in: group) == 0)
    #expect(session.isGroupViewed(group) == true)
}
