/**
 * SECTION wrapper. Mirrors the "section card" pattern used elsewhere in the
 * project (SEE workflow, dashboard cards) so the modal feels native rather
 * than bolted-on.
 */
export default function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm">
          <Icon className="h-3 w-3" />
        </span>
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          {title}
        </h4>
        <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
      </div>
      {children}
    </section>
  );
}
