import { Body, Controller, Post } from '@nestjs/common';
import { AuthLoginRequestDto, AuthLoginResponseDto } from '@open-story/contracts';
import { AuthService } from './auth.service';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() payload: AuthLoginRequestDto): AuthLoginResponseDto {
    return this.authService.login(payload);
  }
}
