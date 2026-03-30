import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ClientTokenModule } from './modules/client-token/client-token.module';
import { PlacementModule } from './modules/placement/placement.module';
import { StoryGroupSetModule } from './modules/story-group-set/story-group-set.module';
import { StoryGroupModule } from './modules/story-group/story-group.module';
import { StoryModule } from './modules/story/story.module';
import { AssetsModule } from './modules/assets/assets.module';
import { SdkFeedModule } from './modules/sdk-feed/sdk-feed.module';

@Module({
  imports: [
    AuthModule,
    ClientTokenModule,
    PlacementModule,
    StoryGroupSetModule,
    StoryGroupModule,
    StoryModule,
    AssetsModule,
    SdkFeedModule,
  ],
})
export class AppModule {}
