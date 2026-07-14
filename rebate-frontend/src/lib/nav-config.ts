import {
  LayoutDashboard,
  Users,
  BarChart3,
  CreditCard,
  TrendingUp,
  Download,
  Settings,
  Bell,
  UserCog,
  TableProperties,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

export type NavRole = 'ADMIN' | 'IB';

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: NavRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/dashboard/tree', labelKey: 'ibNetwork', icon: Users },
  { href: '/dashboard/report', labelKey: 'report', icon: BarChart3 },
  { href: '/dashboard/ib-management', labelKey: 'ibManagement', icon: Users },
  { href: '/dashboard/payout', labelKey: 'payout', icon: CreditCard },
  { href: '/dashboard/transaction', labelKey: 'transaction', icon: TrendingUp },
  { href: '/dashboard/export', labelKey: 'export', icon: Download },
  { href: '/dashboard/rebate', labelKey: 'config', icon: Settings },
  { href: '/dashboard/notification', labelKey: 'notifications', icon: Bell },
  { href: '/dashboard/rebate-management', labelKey: 'rebateManagement', icon: TableProperties, roles: ['ADMIN'] },
  { href: '/dashboard/admin', labelKey: 'adminManagement', icon: UserCog, roles: ['ADMIN'] },
  { href: '/dashboard/trash', labelKey: 'trash', icon: Trash2, roles: ['ADMIN'] },
  { href: '/account', labelKey: 'accountNav', icon: UserCog },
];

export function filterNavItemsByRole(role: NavRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
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

export function getNavLabelKeyForPath(pathname: string): string | undefined {
  const item = NAV_ITEMS.find(
    (nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`),
  );
  return item?.labelKey;
}
