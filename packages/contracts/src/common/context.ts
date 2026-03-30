import { z } from 'zod';

/**
 * SDK runtime context types.
 */
export const platformSchema = z.enum(['ios', 'android']);

const semverLikePattern = /^\d+(?:\.\d+){0,2}$/;

/**
 * v1 supports dotted numeric version comparison only.
 * Accepted formats: major, major.minor, major.minor.patch
 */
export const appVersionSchema = z
  .string()
  .trim()
  .regex(
    semverLikePattern,
    'app_version must be a dotted numeric version (major.minor.patch)',
  );

/**
 * User segments are optional and normalized as unique, trimmed values.
 */
export const userSegmentSchema = z
  .string()
  .trim()
  .min(1, 'segment cannot be empty')
  .max(64, 'segment length must be <= 64');

export const userSegmentsSchema = z
  .array(userSegmentSchema)
  .max(100, 'user_segments length must be <= 100')
  .transform((segments) => Array.from(new Set(segments)));

export type Platform = z.infer<typeof platformSchema>;
export type AppVersion = z.infer<typeof appVersionSchema>;
export type UserSegment = z.infer<typeof userSegmentSchema>;
export type UserSegments = z.infer<typeof userSegmentsSchema>;
