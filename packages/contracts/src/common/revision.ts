import { z } from 'zod';

/**
 * Root and revision identifiers are UUIDs in v1 contracts.
 */
export const rootIdSchema = z.string().uuid();
export const revisionIdSchema = z.string().uuid();

export const entityRevisionRefSchema = z.object({
  id: rootIdSchema,
  revision_id: revisionIdSchema,
});

export type RootId = z.infer<typeof rootIdSchema>;
export type RevisionId = z.infer<typeof revisionIdSchema>;
export type EntityRevisionRef = z.infer<typeof entityRevisionRefSchema>;
