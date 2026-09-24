import { Link, useLocation } from "react-router-dom";
import { useAppStore } from "@/shared/store/app.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { getVisibleNavItems } from "@/shared/lib/navigation";
import { ROLE_LABELS } from "@/shared/constants/roles";

export default function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);

  const visibleItems = getVisibleNavItems(user?.activeRole ?? undefined);
  // Section header shows the currently active role (CS / DCS / RS / Invigilator).
  const sectionLabel = user?.activeRole ? ROLE_LABELS[user.activeRole] : "Navigation";

  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] border-r border-gray-800 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white transition-all duration-300 ${
        sidebarOpen ? "w-60" : "w-0 overflow-hidden"
      }`}
    >
      <nav className="flex flex-col gap-1 p-4">
        <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {sectionLabel}
        </span>
        {visibleItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 font-medium text-white shadow-md shadow-blue-600/30"
                  : "text-gray-300 hover:translate-x-0.5 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
