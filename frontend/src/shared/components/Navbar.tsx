import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ChevronDown, LogOut } from "lucide-react";
import { useAppStore } from "@/shared/store/app.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useUnreadCount } from "@/modules/notifications/hooks";
import NotificationList from "@/modules/notifications/components/NotificationList";
import RoleSelectionModal from "@/modules/auth/components/RoleSelectionModal";
import DarkModeToggle from "@/shared/components/DarkModeToggle";
import Logo from "@/shared/components/Logo";
import { ROLE_LABELS } from "@/shared/constants/roles";

export default function Navbar() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [switchRoleOpen, setSwitchRoleOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount } = useUnreadCount();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const hasMultipleRoles = (user?.roles?.length || 0) > 1;

  return (
    <header className="fixed left-0 top-0 z-40 flex h-16 w-full items-center justify-between bg-gray-800 px-6 text-white shadow-md">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded p-1 hover:bg-gray-700"
          aria-label="Toggle sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <Logo
          size={30}
          showWordmark
          className="text-white"
          wordmarkClassName="text-lg font-bold tracking-tight text-white"
        />
      </div>

      <div className="flex items-center gap-4">
        <DarkModeToggle />
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative rounded p-1 hover:bg-gray-700"
            aria-label="Notifications"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {!!unreadCount && unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2">
              <NotificationList />
            </div>
          )}
        </div>

        {user && (
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
            >
              <span>{user.name}</span>
              {user.activeRole && (
                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {ROLE_LABELS[user.activeRole]}
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-gray-700 bg-gray-800 py-1 text-sm shadow-lg">
                {hasMultipleRoles && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setSwitchRoleOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 hover:bg-gray-700"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Switch Role
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 hover:bg-gray-700"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <RoleSelectionModal
        open={switchRoleOpen}
        onClose={() => setSwitchRoleOpen(false)}
      />
    </header>
  );
}
