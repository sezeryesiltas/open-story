import { randomUUID } from 'node:crypto';

import { CreatePlacementDto, PlacementDto, UpdatePlacementDto } from '@open-story/contracts';
import { DbService } from '@open-story/db';

const db = new DbService();

export class PlacementStoreError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: 'conflict' | 'not_found' | 'validation_error',
  ) {
    super(message);
    this.name = 'PlacementStoreError';
  }
}

export function listPlacements(): PlacementDto[] {
  return db
    .list<PlacementDto>('placements')
    .sort((left: PlacementDto, right: PlacementDto) => right.updatedAt.localeCompare(left.updatedAt));
}

function findPlacementById(id: string): PlacementDto | undefined {
  return db.findById<PlacementDto>('placements', id);
}

function findPlacementByKey(key: string): PlacementDto | undefined {
  return db.list<PlacementDto>('placements').find((placement: PlacementDto) => placement.key === key);
}

export function createPlacement(payload: CreatePlacementDto): PlacementDto {
  const key = payload.key.trim();
  const name = payload.name.trim();

  if (!key) {
    throw new PlacementStoreError('placement key is required', 400, 'validation_error');
  }

  if (!name) {
    throw new PlacementStoreError('placement name is required', 400, 'validation_error');
  }

  if (findPlacementByKey(key)) {
    throw new PlacementStoreError('placement key already exists', 409, 'conflict');
  }

  const now = new Date().toISOString();

  return db.insert<PlacementDto>('placements', {
    id: randomUUID(),
    key,
    name,
    description: payload.description?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });
}

export function updatePlacement(id: string, payload: UpdatePlacementDto): PlacementDto {
  const existingPlacement = findPlacementById(id);
  if (!existingPlacement) {
    throw new PlacementStoreError('Placement not found', 404, 'not_found');
  }

  const key = payload.key?.trim() ?? existingPlacement.key;
  const name = payload.name?.trim() ?? existingPlacement.name;

  if (!key) {
    throw new PlacementStoreError('placement key is required', 400, 'validation_error');
  }

  if (!name) {
    throw new PlacementStoreError('placement name is required', 400, 'validation_error');
  }

  const duplicatePlacement = findPlacementByKey(key);
  if (duplicatePlacement && duplicatePlacement.id !== id) {
    throw new PlacementStoreError('placement key already exists', 409, 'conflict');
  }

  const updatedPlacement = db.updateById<PlacementDto>('placements', id, {
    key,
    name,
    description:
      payload.description !== undefined ? payload.description.trim() || null : existingPlacement.description,
    updatedAt: new Date().toISOString(),
  });

  if (!updatedPlacement) {
    throw new PlacementStoreError('Placement not found', 404, 'not_found');
  }

  return updatedPlacement;
}
