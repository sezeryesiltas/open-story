import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthLoginRequestDto, AuthLoginResponseDto } from '@open-story/contracts';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  login(payload: AuthLoginRequestDto): AuthLoginResponseDto {
    const user = this.authRepository.findByEmail(payload.email);
    if (!user || user.passwordHash !== `plain:${payload.password}`) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: `access-${user.id}`,
      expiresIn: 3600,
    };
  }
}
