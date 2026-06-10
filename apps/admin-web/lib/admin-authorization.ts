import type { AdminRole } from '@open-story/contracts';

export const adminRoleLabels: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  story_admin: 'Story Admin',
  story_editor: 'Story Editor',
};

const rolePageAccess: Record<AdminRole, string[]> = {
  super_admin: [
    '/',
    '/placements',
    '/story-group-sets',
    '/story-groups',
    '/stories',
    '/assets',
    '/preview',
    '/client',
    '/users',
    '/settings',
    '/settings/storage',
    '/change-password',
  ],
  story_admin: [
    '/',
    '/placements',
    '/story-group-sets',
    '/story-groups',
    '/stories',
    '/assets',
    '/preview',
    '/change-password',
  ],
  story_editor: ['/', '/stories', '/assets', '/preview', '/change-password'],
};

export function canAdminRoleAccessPath(role: AdminRole, path: string): boolean {
  const normalizedPath = normalizePath(path);
  return rolePageAccess[role].includes(normalizedPath);
}

export function getAdminRoleLabel(role: AdminRole): string {
  return adminRoleLabels[role];
}

function normalizePath(path: string): string {
  if (path === '/') {
    return path;
  }

  return path.replace(/\/+$/, '');
}
