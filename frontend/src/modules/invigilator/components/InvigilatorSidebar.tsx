import { Link, useLocation } from "react-router-dom";
import { useAppStore } from "@/shared/store/app.store";
import { INVIGILATOR_CONFIG } from "@/modules/shared/role-config/roleConfig";
import MessagesNavBadge from "@/modules/messages/components/MessagesNavBadge";

export default function InvigilatorSidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const { pathname } = useLocation();
  const { sectionLabel, navItems } = INVIGILATOR_CONFIG;

  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-gray-900 text-white transition-all duration-300 ${
        sidebarOpen ? "w-60" : "w-0 overflow-hidden"
      }`}
    >
      <nav className="flex flex-col gap-1 p-4">
        <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {sectionLabel}
        </span>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-gray-700 font-medium text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.path.endsWith("/messages") && (
                <MessagesNavBadge variant="teacher" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
