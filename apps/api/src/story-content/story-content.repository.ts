import { randomUUID } from 'node:crypto';

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

export class StoryContentRepository {
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

  createSetRoot(record: StoryGroupSetRootRecord): StoryGroupSetRootRecord {
    return this.db.insert<StoryGroupSetRootRecord>('storyGroupSets', record);
  }

  updateSetRoot(setId: string, patch: Partial<StoryGroupSetRootRecord>): StoryGroupSetRootRecord | null {
    return this.db.updateById<StoryGroupSetRootRecord>('storyGroupSets', setId, patch) ?? null;
  }

  updateSetRootPublishedRevision(setId: string, revisionId: string, updatedAt: string): StoryGroupSetRootRecord | null {
    return this.updateSetRoot(setId, {
      currentPublishedRevisionId: revisionId,
      updatedAt,
    });
  }

  findSetRevisionById(id: string): StoryGroupSetRevisionRecord | null {
    return this.db.findById<StoryGroupSetRevisionRecord>('storyGroupSetRevisions', id) ?? null;
  }

  listSetRevisionsBySetId(setId: string): StoryGroupSetRevisionRecord[] {
    return this.db
      .list<StoryGroupSetRevisionRecord>('storyGroupSetRevisions')
      .filter((record) => record.storyGroupSetId === setId)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
  }

  createSetRevision(record: StoryGroupSetRevisionRecord): StoryGroupSetRevisionRecord {
    return this.db.insert<StoryGroupSetRevisionRecord>('storyGroupSetRevisions', record);
  }

  updateSetRevisionStatus(revisionId: string, status: StoryGroupSetRevisionRecord['status']): StoryGroupSetRevisionRecord | null {
    return this.db.updateById<StoryGroupSetRevisionRecord>('storyGroupSetRevisions', revisionId, { status }) ?? null;
  }

  listSetRevisionGroups(revisionId: string): StoryGroupSetRevisionGroupRecord[] {
    return this.db
      .list<StoryGroupSetRevisionGroupRecord>('storyGroupSetRevisionGroups')
      .filter((record) => record.storyGroupSetRevisionId === revisionId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  replaceSetRevisionGroups(revisionId: string, groupIds: string[], createdAt: string): StoryGroupSetRevisionGroupRecord[] {
    for (const record of this.listSetRevisionGroups(revisionId)) {
      this.db.deleteById('storyGroupSetRevisionGroups', record.id);
    }

    return groupIds.map((groupId, index) =>
      this.db.insert<StoryGroupSetRevisionGroupRecord>('storyGroupSetRevisionGroups', {
        id: randomUUID(),
        storyGroupSetRevisionId: revisionId,
        storyGroupId: groupId,
        sortOrder: index,
        createdAt,
      }),
    );
  }

  listGroupRoots(): StoryGroupRootRecord[] {
    return this.db.list<StoryGroupRootRecord>('storyGroups');
  }

  findGroupRootById(id: string): StoryGroupRootRecord | null {
    return this.db.findById<StoryGroupRootRecord>('storyGroups', id) ?? null;
  }

  createGroupRoot(record: StoryGroupRootRecord): StoryGroupRootRecord {
    return this.db.insert<StoryGroupRootRecord>('storyGroups', record);
  }

  updateGroupRoot(groupId: string, patch: Partial<StoryGroupRootRecord>): StoryGroupRootRecord | null {
    return this.db.updateById<StoryGroupRootRecord>('storyGroups', groupId, patch) ?? null;
  }

  updateGroupRootPublishedRevision(groupId: string, revisionId: string, updatedAt: string): StoryGroupRootRecord | null {
    return this.updateGroupRoot(groupId, {
      currentPublishedRevisionId: revisionId,
      updatedAt,
    });
  }

  findGroupRevisionById(id: string): StoryGroupRevisionRecord | null {
    return this.db.findById<StoryGroupRevisionRecord>('storyGroupRevisions', id) ?? null;
  }

  listGroupRevisionsByGroupId(groupId: string): StoryGroupRevisionRecord[] {
    return this.db
      .list<StoryGroupRevisionRecord>('storyGroupRevisions')
      .filter((record) => record.storyGroupId === groupId)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
  }

  createGroupRevision(record: StoryGroupRevisionRecord): StoryGroupRevisionRecord {
    return this.db.insert<StoryGroupRevisionRecord>('storyGroupRevisions', record);
  }

  updateGroupRevisionStatus(revisionId: string, status: StoryGroupRevisionRecord['status']): StoryGroupRevisionRecord | null {
    return this.db.updateById<StoryGroupRevisionRecord>('storyGroupRevisions', revisionId, { status }) ?? null;
  }

  listGroupRevisionStories(revisionId: string): StoryGroupRevisionStoryRecord[] {
    return this.db
      .list<StoryGroupRevisionStoryRecord>('storyGroupRevisionStories')
      .filter((record) => record.storyGroupRevisionId === revisionId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  replaceGroupRevisionStories(revisionId: string, storyIds: string[], createdAt: string): StoryGroupRevisionStoryRecord[] {
    for (const record of this.listGroupRevisionStories(revisionId)) {
      this.db.deleteById('storyGroupRevisionStories', record.id);
    }

    return storyIds.map((storyId, index) =>
      this.db.insert<StoryGroupRevisionStoryRecord>('storyGroupRevisionStories', {
        id: randomUUID(),
        storyGroupRevisionId: revisionId,
        storyId,
        sortOrder: index,
        createdAt,
      }),
    );
  }

  findDraftGroupIdsForStory(storyId: string): string[] {
    return this.listGroupRoots()
      .filter((groupRoot) => {
        const draftRevisionId = groupRoot.currentDraftRevisionId;
        return this.listGroupRevisionStories(draftRevisionId).some((record) => record.storyId === storyId);
      })
      .map((groupRoot) => groupRoot.id);
  }

  findPublishedGroupIdsForStory(storyId: string): string[] {
    return this.listGroupRoots()
      .filter((groupRoot) => {
        if (!groupRoot.currentPublishedRevisionId) {
          return false;
        }

        return this.listGroupRevisionStories(groupRoot.currentPublishedRevisionId).some((record) => record.storyId === storyId);
      })
      .map((groupRoot) => groupRoot.id);
  }

  listStoryRoots(): StoryRootRecord[] {
    return this.db.list<StoryRootRecord>('stories');
  }

  findStoryRootById(id: string): StoryRootRecord | null {
    return this.db.findById<StoryRootRecord>('stories', id) ?? null;
  }

  createStoryRoot(record: StoryRootRecord): StoryRootRecord {
    return this.db.insert<StoryRootRecord>('stories', record);
  }

  updateStoryRoot(storyId: string, patch: Partial<StoryRootRecord>): StoryRootRecord | null {
    return this.db.updateById<StoryRootRecord>('stories', storyId, patch) ?? null;
  }

  updateStoryRootPublishedRevision(storyId: string, revisionId: string, updatedAt: string): StoryRootRecord | null {
    return this.updateStoryRoot(storyId, {
      currentPublishedRevisionId: revisionId,
      updatedAt,
    });
  }

  findStoryRevisionById(id: string): StoryRevisionRecord | null {
    return this.db.findById<StoryRevisionRecord>('storyRevisions', id) ?? null;
  }

  listStoryRevisionsByStoryId(storyId: string): StoryRevisionRecord[] {
    return this.db
      .list<StoryRevisionRecord>('storyRevisions')
      .filter((record) => record.storyId === storyId)
      .sort((left, right) => left.revisionNumber - right.revisionNumber);
  }

  createStoryRevision(record: StoryRevisionRecord): StoryRevisionRecord {
    return this.db.insert<StoryRevisionRecord>('storyRevisions', record);
  }

  updateStoryRevisionStatus(revisionId: string, status: StoryRevisionRecord['status']): StoryRevisionRecord | null {
    return this.db.updateById<StoryRevisionRecord>('storyRevisions', revisionId, { status }) ?? null;
  }

  findAssetById(id: string): AssetRecord | null {
    return this.db.findById<AssetRecord>('assets', id) ?? null;
  }
}
