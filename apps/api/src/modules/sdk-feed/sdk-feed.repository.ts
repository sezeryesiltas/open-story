import { Injectable } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { SdkFeedResponseDto } from '@open-story/contracts';

@Injectable()
export class SdkFeedRepository {
  constructor(private readonly db: DbService) {}

  getByPlacementKey(placementKey: string): SdkFeedResponseDto {
    const groups = this.db.list<any>('storyGroups').map((group) => ({
      group_id: group.id,
      group_revision_id: `${group.id}:rev1`,
      title: group.title,
      logo_url: 'https://cdn.example/logo.png',
      stories: this.db
        .list<any>('stories')
        .filter((story) => story.storyGroupId === group.id)
        .map((story) => ({
          story_id: story.id,
          story_revision_id: `${story.id}:rev1`,
          media_type: story.mediaType,
          media_url: 'https://cdn.example/story.mp4',
        })),
    }));

    return {
      placement_key: placementKey,
      set_id: 'set_1',
      set_revision_id: 'set_1:rev1',
      groups,
    };
  }
}
