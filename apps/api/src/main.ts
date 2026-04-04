import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.ts';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.ts';

const DEFAULT_API_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useStaticAssets(resolveAssetsRoot(), {
    prefix: '/uploads/assets/',
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(Number(process.env.OPEN_STORY_API_PORT?.trim() || DEFAULT_API_PORT));
}

function resolveAssetsRoot(): string {
  const configuredDir = process.env.OPEN_STORY_ASSET_STORAGE_DIR?.trim();
  if (configuredDir) {
    return resolve(configuredDir);
  }

  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (workspaceRoot) {
    return resolve(workspaceRoot, 'apps/api/data/assets');
  }

  return resolve(process.cwd(), 'apps/api/data/assets');
}

function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    if (existsSync(resolve(currentDir, 'apps/api')) && existsSync(resolve(currentDir, 'apps/admin-web'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

bootstrap();
