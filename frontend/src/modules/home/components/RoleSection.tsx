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
    <section
      id="roles"
      className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Built for every role
        </h2>
        <p className="mt-3 text-slate-400">
          From the Controller down to a single-room invigilator, everyone gets a
          workflow that fits.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <RoleCard key={r.name} {...r} />
        ))}
      </div>
    </section>
  );
}
