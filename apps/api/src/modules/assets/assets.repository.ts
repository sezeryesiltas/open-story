import type {
  AssetRecord,
  StoryGroupRevisionRecord,
  StoryGroupRootRecord,
  StoryRevisionRecord,
  StoryRootRecord,
} from '@open-story/contracts';
import { DbService } from '@open-story/db';

export type AssetUsageReference = {
  entityType: 'story_group' | 'story';
  entityId: string;
  revisionId: string;
  revisionStatus: 'draft' | 'published';
  field: 'logo' | 'media' | 'poster';
  name: string;
};

export class AssetsRepository {
  private readonly db: DbService;

  constructor(db: DbService) {
    this.db = db;
  }

  list(): AssetRecord[] {
    return this.db
      .list<AssetRecord>('assets')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  create(row: AssetRecord): AssetRecord {
    return this.db.insert<AssetRecord>('assets', row);
  }

  findById(assetId: string): AssetRecord | null {
    return this.db.findById<AssetRecord>('assets', assetId) ?? null;
  }

  deleteById(assetId: string): boolean {
    return this.db.deleteById('assets', assetId);
  }

  listCurrentUsage(assetId: string): AssetUsageReference[] {
    const usage: AssetUsageReference[] = [];
    const groupRevisionById = new Map(
      this.db.list<StoryGroupRevisionRecord>('storyGroupRevisions').map((revision) => [revision.id, revision]),
    );
    const storyRevisionById = new Map(
      this.db.list<StoryRevisionRecord>('storyRevisions').map((revision) => [revision.id, revision]),
    );

    for (const groupRoot of this.db.list<StoryGroupRootRecord>('storyGroups')) {
      for (const revisionId of getCurrentRevisionIds(groupRoot.currentDraftRevisionId, groupRoot.currentPublishedRevisionId)) {
        const revision = groupRevisionById.get(revisionId);
        if (!revision || revision.logoAssetId !== assetId) {
          continue;
        }

        usage.push({
          entityType: 'story_group',
          entityId: groupRoot.id,
          revisionId: revision.id,
          revisionStatus: revision.status,
          field: 'logo',
          name: revision.name,
        });
      }
    }

    for (const storyRoot of this.db.list<StoryRootRecord>('stories')) {
      for (const revisionId of getCurrentRevisionIds(storyRoot.currentDraftRevisionId, storyRoot.currentPublishedRevisionId)) {
        const revision = storyRevisionById.get(revisionId);
        if (!revision) {
          continue;
        }

        if (revision.assetId === assetId) {
          usage.push({
            entityType: 'story',
            entityId: storyRoot.id,
            revisionId: revision.id,
            revisionStatus: revision.status,
            field: 'media',
            name: revision.name,
          });
        }

        if (revision.posterAssetId === assetId) {
          usage.push({
            entityType: 'story',
            entityId: storyRoot.id,
            revisionId: revision.id,
            revisionStatus: revision.status,
            field: 'poster',
            name: revision.name,
          });
        }
      }
    }

    return usage;
  }
}

function getCurrentRevisionIds(draftRevisionId: string, publishedRevisionId: string | null): string[] {
  return [...new Set([draftRevisionId, publishedRevisionId].filter((revisionId): revisionId is string => Boolean(revisionId)))];
}
