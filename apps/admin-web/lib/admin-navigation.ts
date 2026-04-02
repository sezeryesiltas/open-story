import {
  Clapperboard,
  Database,
  Eye,
  Home,
  KeyRound,
  Layers3,
  LogIn,
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
        description: 'V1 kapsamı, ekran haritası ve sonraki teslimatlar.',
        href: '/',
        icon: Home
      },
      {
        title: 'Placements',
        description: 'Placement listeleme, oluşturma ve düzenleme yüzeyi.',
        href: '/placements',
        icon: Layers3
      },
      {
        title: 'Client & Tokens',
        description: 'Tek client görünümü ve static token operasyonları.',
        href: '/client',
        icon: KeyRound
      },
      {
        title: 'Settings',
        description: 'Varsayılan sqlite ve harici DB hedefi ayarları.',
        href: '/settings',
        icon: Database
      }
    ]
  },
  {
    title: 'Content',
    items: [
      {
        title: 'Story Bars',
        description: 'Targeting, composition ve publish validation akışı.',
        href: '/story-group-sets',
        icon: SquareStack
      },
      {
        title: 'Story Groups',
        description: 'Paylaşımlı group yönetimi, archive ve publish yaşam döngüsü.',
        href: '/story-groups',
        icon: SquareStack
      },
      {
        title: 'Stories',
        description: 'Media, CTA ve revision tabanlı story düzenleme alanı.',
        href: '/stories',
        icon: Clapperboard
      },
      {
        title: 'Preview',
        description: 'Feed contract üzerinden temel editorial doğrulama.',
        href: '/preview',
        icon: Eye
      }
    ]
  },
  {
    title: 'Access',
    items: [
      {
        title: 'Users',
        description: 'Admin kullanıcı oluşturma, reset ve first-login zorlaması.',
        href: '/users',
        icon: Users
      },
      {
        title: 'Login',
        description: 'Email + password ile giriş akışı.',
        href: '/login',
        icon: LogIn
      },
      {
        title: 'Change Password',
        description: 'İlk girişte zorunlu parola yenileme ekranı.',
        href: '/change-password',
        icon: ShieldCheck
      }
    ]
  }
];

export const adminNavItems = adminNavSections.flatMap((section) => section.items);
