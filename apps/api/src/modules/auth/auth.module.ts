import { Module } from '@nestjs/common';
import { DbService } from '@open-story/db';
import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../../admin-auth/simple-jwt.ts';
import { StoryPlatformRepository } from '../../story-platform/story-platform.repository.ts';
import { AuthController } from './auth.controller.ts';
import { AuthService } from './auth.service.ts';

@Module({
  controllers: [AuthController],
  providers: [
    DbService,
    {
      provide: StoryPlatformRepository,
      useFactory: (db: DbService) => new StoryPlatformRepository(db),
      inject: [DbService],
    },
    {
      provide: SimpleJwtService,
      useFactory: () => new SimpleJwtService(),
    },
    {
      provide: AdminAccessService,
      useFactory: (repository: StoryPlatformRepository, jwtService: SimpleJwtService) =>
        new AdminAccessService(repository, jwtService),
      inject: [StoryPlatformRepository, SimpleJwtService],
    },
    {
      provide: AuthService,
      useFactory: (
        repository: StoryPlatformRepository,
        jwtService: SimpleJwtService,
        adminAccessService: AdminAccessService,
      ) => new AuthService(repository, jwtService, adminAccessService),
      inject: [StoryPlatformRepository, SimpleJwtService, AdminAccessService],
    },
  ],
})
export class AuthModule {}
