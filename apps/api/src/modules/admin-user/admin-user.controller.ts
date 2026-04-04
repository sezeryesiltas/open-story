import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import type { AdminUserDto, CreateAdminUserDto, ResetAdminUserPasswordDto } from '@open-story/contracts';

import { AdminUserService } from './admin-user.service.ts';

@Controller('v1/admin-users')
export class AdminUserController {
  @Inject(AdminUserService)
  private readonly adminUserService!: AdminUserService;

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<AdminUserDto[]> {
    return this.adminUserService.list(authorization);
  }

  @Post()
  async create(
    @Body() payload: CreateAdminUserDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AdminUserDto> {
    return this.adminUserService.create(payload, authorization);
  }

  @Post(':userId/reset-password')
  async resetPassword(
    @Param('userId') userId: string,
    @Body() payload: ResetAdminUserPasswordDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AdminUserDto> {
    return this.adminUserService.resetPassword(userId, payload, authorization);
  }
}
