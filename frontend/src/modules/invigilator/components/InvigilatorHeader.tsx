import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu, ArrowLeftRight } from "lucide-react";
import { useAppStore } from "@/shared/store/app.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useScopedUnreadCount } from "@/modules/notifications/hooks";
import NotificationList from "@/modules/notifications/components/NotificationList";
import RoleSelectionModal from "@/modules/auth/components/RoleSelectionModal";
import DarkModeToggle from "@/shared/components/DarkModeToggle";

const ROLE_LABELS: Record<string, string> = {
  cs: "CS",
  dcs: "DCS",
  rs: "RS",
  invigilator: "Invigilator",
};

export default function InvigilatorHeader() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switchRoleOpen, setSwitchRoleOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasMultipleRoles = (user?.roles?.length ?? 0) > 1;

  const unreadCount = useScopedUnreadCount();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="fixed left-0 top-0 z-10 flex h-16 w-full items-center justify-between bg-gray-800 px-6 text-white shadow-md">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded p-1 hover:bg-gray-700"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-lg font-bold">Exam Duty</span>
      </div>

      <div className="flex items-center gap-4">
        <DarkModeToggle />
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="relative rounded p-1 hover:bg-gray-700"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" />
            {!!unreadCount && unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2">
              <NotificationList />
            </div>
          )}
        </div>

        {hasMultipleRoles && (
          <button
            onClick={() => setSwitchRoleOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-400/50 transition-colors hover:bg-indigo-400"
            title="Switch to another dashboard"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Switch Role</span>
            {user?.activeRole && (
              <span className="rounded bg-indigo-600/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                {ROLE_LABELS[user.activeRole] ?? user.activeRole}
              </span>
            )}
          </button>
        )}

        {user && <span className="text-sm text-gray-300">{user.name}</span>}
        <button
          onClick={handleLogout}
          className="rounded px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          Logout
        </button>
      </div>

      <RoleSelectionModal
        open={switchRoleOpen}
        onClose={() => setSwitchRoleOpen(false)}
      />
    </header>
  );
}
