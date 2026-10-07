import {
  LayoutDashboard,
  FilePlus,
  FileText,
  ArrowLeftRight,
  ClipboardList,
  Users,
  Building2,
  DoorOpen,
  BarChart3,
  ScrollText,
  Megaphone,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "./types";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

const ADMIN_ROLES: UserRole[] = ["cs", "dcs", "rs"];
const CS_ONLY: UserRole[] = ["cs"];

export const navItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ADMIN_ROLES },
  { path: "/create-exams", label: "Create Exams", icon: FilePlus, roles: ADMIN_ROLES },
  { path: "/exams", label: "Exams", icon: FileText, roles: ADMIN_ROLES },
  { path: "/messages", label: "Messages", icon: MessageSquare, roles: CS_ONLY },
  { path: "/requests", label: "Change Requests", icon: ArrowLeftRight, roles: ADMIN_ROLES },
  { path: "/manage-duties", label: "Manage Duties", icon: ClipboardList, roles: ADMIN_ROLES },
  { path: "/users", label: "Teachers", icon: Users, roles: CS_ONLY },
  { path: "/notify", label: "Notify", icon: Megaphone, roles: CS_ONLY },
  { path: "/departments", label: "Departments", icon: Building2, roles: ADMIN_ROLES },
  { path: "/infrastructure", label: "Rooms & Buildings", icon: DoorOpen, roles: ADMIN_ROLES },
  { path: "/reports", label: "Reports", icon: BarChart3, roles: ADMIN_ROLES },
  { path: "/audit", label: "Audit Log", icon: ScrollText, roles: ADMIN_ROLES },
];

export function getVisibleNavItems(role: UserRole | null | undefined): NavItem[] {
  return navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );
}
