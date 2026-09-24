import { useAppStore } from "@/shared/store/app.store";

interface MainContentProps {
  children: React.ReactNode;
}

/**
 * The primary content column that sits beside the sidebar. Its left margin
 * tracks the sidebar's open/closed state (the sidebar itself collapses to
 * width 0), so hiding the sidebar reclaims the horizontal space instead of
 * leaving a blank gutter. Owned centrally so every role's layout stays in sync.
 */
export default function MainContent({ children }: MainContentProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <main
      className={`pt-16 p-6 transition-all duration-300 ${
        sidebarOpen ? "ml-60" : "ml-0"
      }`}
    >
      {children}
    </main>
  );
}
