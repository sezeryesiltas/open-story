import { Module } from '@nestjs/common';
import { AdminUserModule } from './modules/admin-user/admin-user.module.ts';
import { AuthModule } from './modules/auth/auth.module.ts';
import { ClientModule } from './modules/client/client.module.ts';
import { ClientTokenModule } from './modules/client-token/client-token.module.ts';
import { PlacementModule } from './modules/placement/placement.module.ts';
import { StoryGroupSetModule } from './modules/story-group-set/story-group-set.module.ts';
import { StoryGroupModule } from './modules/story-group/story-group.module.ts';
import { StoryModule } from './modules/story/story.module.ts';
import { AssetsModule } from './modules/assets/assets.module.ts';
import { SdkFeedModule } from './modules/sdk-feed/sdk-feed.module.ts';
import { SettingsModule } from './modules/settings/settings.module.ts';

@Module({
  imports: [
    AdminUserModule,
    AuthModule,
    ClientModule,
    ClientTokenModule,
    PlacementModule,
    StoryGroupSetModule,
    StoryGroupModule,
    StoryModule,
    AssetsModule,
    SdkFeedModule,
    SettingsModule,
  ],
})
export class AppModule {}
