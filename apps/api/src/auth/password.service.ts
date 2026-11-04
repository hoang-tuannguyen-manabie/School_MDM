import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  hashPassword(plainPassword: string): string {
    const salt = randomBytes(SALT_BYTES).toString('hex');
    const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex');
    return `scrypt$${salt}$${derivedKey}`;
  }

  verifyPassword(plainPassword: string, storedHash: string): boolean {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }

    const [, salt, keyHex] = parts;
    if (!salt || !keyHex) {
      return false;
    }

    const expectedBuffer = Buffer.from(keyHex, 'hex');
    const actualBuffer = scryptSync(plainPassword, salt, expectedBuffer.length);
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
