import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlacementDto, PlacementDto, UpdatePlacementDto } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { PlacementRepository } from './placement.repository.ts';

@Injectable()
export class PlacementService {
  private readonly repository: PlacementRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    @Inject(PlacementRepository) repository: PlacementRepository,
    @Inject(AdminAccessService) adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
  }

  async list(authorization?: string): Promise<PlacementDto[]> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);

    return this.repository
      .list()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(payload: CreatePlacementDto, authorization?: string): Promise<PlacementDto> {
    await this.adminAccessService.requireContentAdminAccess(authorization);

    const key = payload.key.trim();
    const name = payload.name.trim();

    if (!key) {
      throw new ConflictException('placement key is required');
    }

    if (!name) {
      throw new ConflictException('placement name is required');
    }

    if (this.repository.findByKey(key)) {
      throw new ConflictException('placement key already exists');
    }

    const now = new Date().toISOString();

    return this.repository.create({
      id: randomUUID(),
      key,
      name,
      description: payload.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, payload: UpdatePlacementDto, authorization?: string): Promise<PlacementDto> {
    await this.adminAccessService.requireContentAdminAccess(authorization);

    const existingPlacement = this.repository.findById(id);
    if (!existingPlacement) {
      throw new NotFoundException('Placement not found');
    }

    const key = payload.key?.trim() ?? existingPlacement.key;
    const name = payload.name?.trim() ?? existingPlacement.name;

    if (!key) {
      throw new ConflictException('placement key is required');
    }

    if (!name) {
      throw new ConflictException('placement name is required');
    }

    const duplicatePlacement = this.repository.findByKey(key);
    if (duplicatePlacement && duplicatePlacement.id !== id) {
      throw new ConflictException('placement key already exists');
    }

    const updatedPlacement = this.repository.update(id, {
      key,
      name,
      description:
        payload.description !== undefined ? payload.description.trim() || null : existingPlacement.description,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedPlacement) {
      throw new NotFoundException('Placement not found');
    }

    return updatedPlacement;
  }
}
