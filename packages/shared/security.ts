import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import {
  JOB_ACCESS_TOKEN_HEADER,
  RATE_LIMIT_REDIS_KEY_PREFIX
} from './constants';
import type IORedis from 'ioredis';

export function generateJobAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashJobAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqualTokenHash(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');

  if (expected.length === 0 || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

export function getJobAccessTokenFromRequest(request: Request): string | null {
  const headerValue = request.headers.get(JOB_ACCESS_TOKEN_HEADER)?.trim();
  if (headerValue) {
    return headerValue;
  }

  const url = new URL(request.url);
  const queryValue = url.searchParams.get('token')?.trim();
  return queryValue || null;
}

export async function isRateLimited(args: {
  redis: IORedis;
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const key = `${RATE_LIMIT_REDIS_KEY_PREFIX}${args.bucket}:${args.identifier}`;
  const count = await args.redis.incr(key);

  if (count === 1) {
    await args.redis.expire(key, args.windowSeconds);
  }

  return count > args.limit;
}
