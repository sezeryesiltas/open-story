import { Injectable } from '@nestjs/common';
import type { AdminUserRecord } from '@open-story/contracts';

@Injectable()
export class AuthRepository {
  findByEmail(
    email: string,
  ): Pick<AdminUserRecord, 'id' | 'email' | 'passwordHash' | 'isActive'> | undefined {
    if (email === 'admin@openstory.local') {
      return { id: 'admin-1', email, passwordHash: 'plain:admin123', isActive: true };
    }

    return undefined;
  }
}
