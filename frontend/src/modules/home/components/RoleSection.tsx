import { Crown, Users, GraduationCap, ClipboardList } from "lucide-react";
import RoleCard, { type RoleInfo } from "./RoleCard";

const ROLES: RoleInfo[] = [
  {
    icon: Crown,
    name: "CS",
    full: "Controller of Superintendents",
    description:
      "The admin. Creates exams, assigns duties, reviews change requests and oversees the whole invigilation plan.",
    accent: "from-indigo-500 to-violet-600",
  },
  {
    icon: Users,
    name: "DCS",
    full: "Deputy Chief Superintendent",
    description:
      "Supervises groups of rooms sized by student count, coordinating invigilators across a block.",
    accent: "from-sky-500 to-blue-600",
  },
  {
    icon: GraduationCap,
    name: "RS",
    full: "Room Superintendent",
    description:
      "Oversees chunks of up to five rooms per building and slot, managing grouped room duties.",
    accent: "from-amber-500 to-orange-600",
  },
  {
    icon: ClipboardList,
    name: "Invigilator",
    full: "Single-room duty",
    description:
      "Selects and manages individual classroom invigilation duties and raises change requests when needed.",
    accent: "from-emerald-500 to-teal-600",
  },
];

/** The four roles Proctavo is built around. */
export default function RoleSection() {
  return (
    <section id="roles" className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
            One app, four roles
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everyone sees only what they need
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <RoleCard key={r.name} {...r} />
          ))}
        </div>
      </div>
    </section>
  );
}
