import { z } from 'zod';

const ctaLabelSchema = z.string().trim().min(1).max(64);
const ctaValueSchema = z.string().trim().min(1).max(2048);

export const ctaTargetTypeSchema = z.enum(['url', 'deeplink']);

export const ctaSchema = z
  .object({
    label: ctaLabelSchema,
    type: ctaTargetTypeSchema,
    value: ctaValueSchema,
  })
  .strict();

export const optionalCtaSchema = ctaSchema.nullable();

export type CtaTargetType = z.infer<typeof ctaTargetTypeSchema>;
export type Cta = z.infer<typeof ctaSchema>;
