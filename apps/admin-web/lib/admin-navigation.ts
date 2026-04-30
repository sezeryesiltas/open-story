import {
  Clapperboard,
  Cloud,
  Database,
  Eye,
  Home,
  Images,
  KeyRound,
  Layers3,
  ShieldCheck,
  SquareStack,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AdminNavItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    title: 'Console',
    items: [
      {
        title: 'Ana Sayfa',
        description: 'Hızlı erişim ve genel görünüm.',
        href: '/',
        icon: Home
      }
    ]
  },
  {
    title: 'Content',
    items: [
      {
        title: 'Placements',
        description: 'Gösterim alanlarını yönetin.',
        href: '/placements',
        icon: Layers3
      },
      {
        title: 'Story Bars',
        description: 'Story bar listelerini yönetin.',
        href: '/story-group-sets',
        icon: SquareStack
      },
      {
        title: 'Story Groups',
        description: 'Story gruplarını düzenleyin.',
        href: '/story-groups',
        icon: SquareStack
      },
      {
        title: 'Stories',
        description: 'Story içeriklerini yönetin.',
        href: '/stories',
        icon: Clapperboard
      },
      {
        title: 'Assets',
        description: 'Medya dosyalarını yönetin.',
        href: '/assets',
        icon: Images
      },
      {
        title: 'Preview',
        description: 'İçeriği önizleyin.',
        href: '/preview',
        icon: Eye
      }
    ]
  },
  {
    title: 'Settings',
    items: [
      {
        title: 'Client & Tokens',
        description: 'Uygulama erişimini yönetin.',
        href: '/client',
        icon: KeyRound
      },
      {
        title: 'Users',
        description: 'Yönetici hesaplarını yönetin.',
        href: '/users',
        icon: Users
      },
      {
        title: 'DB Settings',
        description: 'Bağlantı ayarlarını yönetin.',
        href: '/settings',
        icon: Database
      },
      {
        title: 'Storage & CDN',
        description: 'Asset storage ayarlarını yönetin.',
        href: '/settings/storage',
        icon: Cloud
      },
      {
        title: 'Change Password',
        description: 'Şifrenizi güncelleyin.',
        href: '/change-password',
        icon: ShieldCheck
      }
    ]
  }
];

export const adminNavItems = adminNavSections.flatMap((section) => section.items);
