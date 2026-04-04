import type {
  AssetRecord,
  PlacementRecord,
  StoryGroupRevisionRecord,
  StoryGroupRevisionStoryRecord,
  StoryGroupRootRecord,
  StoryGroupSetRevisionGroupRecord,
  StoryGroupSetRevisionRecord,
  StoryGroupSetRootRecord,
  StoryRevisionRecord,
  StoryRootRecord,
} from '@open-story/contracts';
import { DbService } from '@open-story/db';

export class PublishResolutionRepository {
  private readonly db: DbService;

  constructor(db: DbService) {
    this.db = db;
  }

  findPlacementById(id: string): PlacementRecord | null {
    return this.db.findById<PlacementRecord>('placements', id) ?? null;
  }

  findPlacementByKey(key: string): PlacementRecord | null {
    return this.db.list<PlacementRecord>('placements').find((placement) => placement.key === key) ?? null;
  }

  listSetRoots(): StoryGroupSetRootRecord[] {
    return this.db.list<StoryGroupSetRootRecord>('storyGroupSets');
  }

  listSetRootsByPlacement(placementId: string): StoryGroupSetRootRecord[] {
    return this.listSetRoots().filter((record) => record.placementId === placementId);
  }

  findSetRootById(id: string): StoryGroupSetRootRecord | null {
    return this.db.findById<StoryGroupSetRootRecord>('storyGroupSets', id) ?? null;
  }

  updateSetRootPublishedRevision(setId: string, revisionId: string, updatedAt: string): StoryGroupSetRootRecord | null {
    return (
      this.db.updateById<StoryGroupSetRootRecord>('storyGroupSets', setId, {
        currentPublishedRevisionId: revisionId,
        updatedAt,
      }) ?? null
    );
  }

  findSetRevisionById(id: string): StoryGroupSetRevisionRecord | null {
    return this.db.findById<StoryGroupSetRevisionRecord>('storyGroupSetRevisions', id) ?? null;
  }

  listSetRevisionGroups(revisionId: string): StoryGroupSetRevisionGroupRecord[] {
    return this.db
      .list<StoryGroupSetRevisionGroupRecord>('storyGroupSetRevisionGroups')
      .filter((record) => record.storyGroupSetRevisionId === revisionId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  listGroupRoots(): StoryGroupRootRecord[] {
    return this.db.list<StoryGroupRootRecord>('storyGroups');
  }

  findGroupRootById(id: string): StoryGroupRootRecord | null {
    return this.db.findById<StoryGroupRootRecord>('storyGroups', id) ?? null;
  }

  updateGroupRootPublishedRevision(groupId: string, revisionId: string, updatedAt: string): StoryGroupRootRecord | null {
    return (
      this.db.updateById<StoryGroupRootRecord>('storyGroups', groupId, {
        currentPublishedRevisionId: revisionId,
        updatedAt,
      }) ?? null
    );
  }

  findGroupRevisionById(id: string): StoryGroupRevisionRecord | null {
    return this.db.findById<StoryGroupRevisionRecord>('storyGroupRevisions', id) ?? null;
  }

  listGroupRevisionStories(revisionId: string): StoryGroupRevisionStoryRecord[] {
    return this.db
      .list<StoryGroupRevisionStoryRecord>('storyGroupRevisionStories')
      .filter((record) => record.storyGroupRevisionId === revisionId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  listStoryRoots(): StoryRootRecord[] {
    return this.db.list<StoryRootRecord>('stories');
  }

  findStoryRootById(id: string): StoryRootRecord | null {
    return this.db.findById<StoryRootRecord>('stories', id) ?? null;
  }

  updateStoryRootPublishedRevision(storyId: string, revisionId: string, updatedAt: string): StoryRootRecord | null {
    return (
      this.db.updateById<StoryRootRecord>('stories', storyId, {
        currentPublishedRevisionId: revisionId,
        updatedAt,
      }) ?? null
    );
  }

  findStoryRevisionById(id: string): StoryRevisionRecord | null {
    return this.db.findById<StoryRevisionRecord>('storyRevisions', id) ?? null;
  }

  findAssetById(id: string): AssetRecord | null {
    return this.db.findById<AssetRecord>('assets', id) ?? null;
  }
}
