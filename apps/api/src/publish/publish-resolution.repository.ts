import { DbService } from '@open-story/db';
import { StoryContentRepository } from '../story-content/story-content.repository.ts';

export class PublishResolutionRepository extends StoryContentRepository {
  constructor(db: DbService) {
    super(db);
  }
}
