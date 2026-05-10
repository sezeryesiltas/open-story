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
    title: 'Genel',
    items: [
      {
        title: 'Ana Sayfa',
        description: 'Hızlı erişim ve genel görünüm.',
        href: '/',
        icon: Home,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      }
    ]
  },
  {
    title: 'İçerik',
    items: [
      {
        title: 'Placements',
        description: 'Gösterim alanlarını yönetin.',
        href: '/placements',
        icon: Shapes,
        roles: ['super_admin', 'story_admin'],
      },
      {
        title: 'Story Bars',
        description: 'Story bar listelerini yönetin.',
        href: '/story-group-sets',
        icon: Layers,
        roles: ['super_admin', 'story_admin'],
      },
      {
        title: 'Story Groups',
        description: 'Story gruplarını düzenleyin.',
        href: '/story-groups',
        icon: SquareStack,
        roles: ['super_admin', 'story_admin'],
      },
      {
        title: 'Stories',
        description: 'Story içeriklerini yönetin.',
        href: '/stories',
        icon: Clapperboard,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      },
      {
        title: 'Assets',
        description: 'Medya dosyalarını yönetin.',
        href: '/assets',
        icon: Images,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      },
      {
        title: 'Preview',
        description: 'İçeriği önizleyin.',
        href: '/preview',
        icon: Eye,
        roles: ['super_admin', 'story_admin', 'story_editor'],
      }
    ]
  },
  {
    title: 'Ayarlar',
    items: [
      {
        title: 'Client & Tokens',
        description: 'Uygulama erişimini yönetin.',
        href: '/client',
        icon: KeyRound,
        roles: ['super_admin'],
      },
      {
        title: 'Users',
        description: 'Yönetici hesaplarını yönetin.',
        href: '/users',
        icon: Users,
        roles: ['super_admin'],
      },
      {
        title: 'DB Settings',
        description: 'Bağlantı ayarlarını yönetin.',
        href: '/settings',
        icon: Database,
        roles: ['super_admin'],
      },
      {
        title: 'Storage & CDN',
        description: 'Asset storage ayarlarını yönetin.',
        href: '/settings/storage',
        icon: Cloud,
        roles: ['super_admin'],
      },
      {
        title: 'Change Password',
        description: 'Şifrenizi güncelleyin.',
        href: '/change-password',
        icon: ShieldCheck,
        roles: ['super_admin'],
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
