import {
  Clapperboard,
  Cloud,
  Database,
  Eye,
  Home,
  Images,
  KeyRound,
  Layers,
  ShieldCheck,
  Shapes,
  SquareStack,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminRole } from '@open-story/contracts';

import { canAdminRoleAccessPath } from './admin-authorization';

export type AdminNavItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles: AdminRole[];
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Home',
        description: 'Quick access and overall status.',
        href: '/',
        icon: Home,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      }
    ]
  },
  {
    title: 'Content',
    items: [
      {
        title: 'Placements',
        description: 'Manage placement surfaces.',
        href: '/placements',
        icon: Shapes,
        roles: ['super_admin', 'story_admin'],
      },
      {
        title: 'Story Bars',
        description: 'Manage story bar sets.',
        href: '/story-group-sets',
        icon: Layers,
        roles: ['super_admin', 'story_admin'],
      },
      {
        title: 'Story Groups',
        description: 'Edit story groups.',
        href: '/story-groups',
        icon: SquareStack,
        roles: ['super_admin', 'story_admin'],
      },
      {
        title: 'Stories',
        description: 'Manage stories.',
        href: '/stories',
        icon: Clapperboard,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      },
      {
        title: 'Assets',
        description: 'Manage media files.',
        href: '/assets',
        icon: Images,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      },
      {
        title: 'Preview',
        description: 'Preview content.',
        href: '/preview',
        icon: Eye,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      }
    ]
  },
  {
    title: 'Settings',
    items: [
      {
        title: 'Client & Tokens',
        description: 'Manage app access.',
        href: '/client',
        icon: KeyRound,
        roles: ['super_admin'],
      },
      {
        title: 'Users',
        description: 'Manage admin accounts.',
        href: '/users',
        icon: Users,
        roles: ['super_admin'],
      },
      {
        title: 'DB Settings',
        description: 'Manage connection settings.',
        href: '/settings',
        icon: Database,
        roles: ['super_admin'],
      },
      {
        title: 'Storage & CDN',
        description: 'Manage asset storage settings.',
        href: '/settings/storage',
        icon: Cloud,
        roles: ['super_admin'],
      },
      {
        title: 'Change Password',
        description: 'Update your password.',
        href: '/change-password',
        icon: ShieldCheck,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      }
    ]
  }
];

export const adminNavItems = adminNavSections.flatMap((section) => section.items);

export function getAdminNavSectionsForRole(role: AdminRole): AdminNavSection[] {
  return adminNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.roles.includes(role) && canAdminRoleAccessPath(role, item.href),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
