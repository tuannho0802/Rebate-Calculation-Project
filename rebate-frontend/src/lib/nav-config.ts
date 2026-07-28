import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Bell,
  UserCog,
  TableProperties,
  Trash2,
  Network,
  type LucideIcon,
} from 'lucide-react';

export type NavRole = 'ADMIN' | 'IB';

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: NavRole[];
  /**
   * When true, this route is restricted to ADMIN + MIB (IB with level === 0).
   * Sub-IBs (level > 0) will NOT see it in the nav and will be redirected
   * away if they navigate to it directly.
   */
  mibOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/dashboard/report', labelKey: 'report', icon: BarChart3 },
  { href: '/dashboard/ib-management', labelKey: 'ibManagement', icon: Users },
  { href: '/dashboard/ib-view', labelKey: 'ibView', icon: Network, roles: ['ADMIN', 'IB'], mibOnly: true },
  { href: '/dashboard/rebate', labelKey: 'config', icon: Settings, roles: ['ADMIN'] },
  { href: '/dashboard/notification', labelKey: 'notifications', icon: Bell },
  { href: '/dashboard/rebate-management', labelKey: 'rebateManagement', icon: TableProperties, roles: ['ADMIN'] },
  { href: '/dashboard/admin', labelKey: 'adminManagement', icon: UserCog, roles: ['ADMIN'] },
  { href: '/dashboard/trash', labelKey: 'trash', icon: Trash2, roles: ['ADMIN'] },
  { href: '/account', labelKey: 'accountNav', icon: UserCog },
];

export function filterNavItemsByRole(role: NavRole | undefined, level?: number): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (item.mibOnly && role !== 'ADMIN' && level !== 0) return false;
    return true;
  });
}

export function isAdminOnlyRoute(pathname: string): boolean {
  return NAV_ITEMS.some(
    (item) =>
      item.roles?.length === 1 &&
      item.roles[0] === 'ADMIN' &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}

/** Routes restricted to ADMIN + MIB (level 0) — deeper IB levels are redirected away. */
export function isMibOnlyRoute(pathname: string): boolean {
  return NAV_ITEMS.some(
    (item) =>
      item.mibOnly &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}

export function getNavLabelKeyForPath(pathname: string): string | undefined {
  const item = NAV_ITEMS.find(
    (nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`),
  );
  return item?.labelKey;
}