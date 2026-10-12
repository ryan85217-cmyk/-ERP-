import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@/i18n/messages";

type NavKey = keyof Messages["nav"];

export interface NavChild {
  key: NavKey;
  href: string;
}
export interface NavGroup {
  key: NavKey;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
}

export const NAV: NavGroup[] = [
  { key: "dashboard", icon: LayoutDashboard, href: "/" },
  {
    key: "products",
    icon: Package,
    children: [
      { key: "productList", href: "/products" },
      { key: "suppliers", href: "/suppliers" },
    ],
  },
  {
    key: "count",
    icon: ClipboardList,
    children: [
      { key: "countNew", href: "/inventory-count/new" },
      { key: "countProgress", href: "/inventory-count" },
      { key: "countHistory", href: "/inventory-count/history" },
      { key: "countAnalysis", href: "/inventory-count/analysis" },
    ],
  },
  {
    key: "inventory",
    icon: Boxes,
    children: [
      { key: "invStore", href: "/inventory/store" },
      { key: "invPos", href: "/inventory/pos" },
      { key: "invWarehouse", href: "/inventory/warehouse" },
      { key: "invAlerts", href: "/inventory/alerts" },
      { key: "locations", href: "/locations" },
    ],
  },
  {
    key: "members",
    icon: Users,
    children: [
      { key: "membersAll", href: "/members" },
      { key: "membersNew", href: "/members/new-members" },
      { key: "membersReturning", href: "/members/returning" },
      { key: "remarketing", href: "/members/remarketing" },
    ],
  },
  {
    key: "analytics",
    icon: BarChart3,
    children: [
      { key: "daily", href: "/analytics/daily" },
      { key: "weekly", href: "/analytics/weekly" },
      { key: "monthly", href: "/analytics/monthly" },
      { key: "yearly", href: "/analytics/yearly" },
    ],
  },
];

const ALL_HREFS = NAV.flatMap((g) => (g.children ? g.children.map((c) => c.href) : g.href ? [g.href] : []));

/** Longest-prefix match so /inventory-count/abc highlights "count progress" and /products/123 highlights "product list". */
export function activeHref(pathname: string) {
  if (pathname === "/") return "/";
  let best = "";
  for (const href of ALL_HREFS) {
    if (href === "/") continue;
    if ((pathname === href || pathname.startsWith(href + "/")) && href.length > best.length) best = href;
  }
  return best;
}
