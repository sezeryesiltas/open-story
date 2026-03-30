import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthRepository {
  findByEmail(email: string): { id: string; email: string; passwordHash: string } | undefined {
    if (email === 'admin@openstory.local') {
      return { id: 'admin-1', email, passwordHash: 'plain:admin123' };
    }

    return undefined;
  }
}
