import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import {
  AuthChangePasswordDto,
  AuthLoginRequestDto,
  AuthLoginResponseDto,
  AuthSessionResponseDto,
} from '@open-story/contracts';
import { AuthService } from './auth.service.ts';

@Controller('v1/auth')
export class AuthController {
  @Inject(AuthService)
  private readonly authService!: AuthService;

  @Post('login')
  async login(@Body() payload: AuthLoginRequestDto): Promise<AuthLoginResponseDto> {
    return this.authService.login(payload);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string): Promise<AuthSessionResponseDto> {
    return this.authService.me(authorization);
  }

  @Post('change-password')
  async changePassword(
    @Body() payload: AuthChangePasswordDto,
    @Headers('authorization') authorization?: string,
  ): Promise<AuthSessionResponseDto> {
    return this.authService.changePassword(payload, authorization);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Headers('authorization') authorization?: string): Promise<void> {
    await this.authService.logout(authorization);
  }
}
