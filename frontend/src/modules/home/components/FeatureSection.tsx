import {
  Bell,
  ClipboardCheck,
  Layers,
  MessagesSquare,
  ArrowLeftRight,
  LayoutDashboard,
} from "lucide-react";
import FeatureCard, { type Feature } from "./FeatureCard";

const FEATURES: Feature[] = [
  {
    icon: LayoutDashboard,
    title: "Role-based dashboards",
    description:
      "Tailored views for CS, DCS, RS and Invigilators — everyone sees exactly what their role needs, nothing more.",
  },
  {
    icon: ClipboardCheck,
    title: "Smart duty assignment",
    description:
      "Computed per-teacher targets and building-aware conflict checks keep every assignment fair and clash-free.",
  },
  {
    icon: Layers,
    title: "Group-aware scheduling",
    description:
      "RS and DCS supervise groups of rooms as one unit — claimed, assigned and counted together, transactionally.",
  },
  {
    icon: ArrowLeftRight,
    title: "Change requests & swaps",
    description:
      "Teachers raise move, drop or swap requests; the Controller reviews and approves them in a single click.",
  },
  {
    icon: MessagesSquare,
    title: "In-app messaging",
    description:
      "Direct teacher-to-CS chat with read receipts, replies, reactions and search — complaints and queries in one place.",
  },
  {
    icon: Bell,
    title: "Notifications & reminders",
    description:
      "Duty reminders, target alerts and unread-message popups keep everyone on time, every exam day.",
  },
];

/** The "what Proctavo does" grid. */
export default function FeatureSection() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Everything you need to run exam duties
        </h2>
        <p className="mt-3 text-slate-400">
          One place to plan, assign, adjust and communicate — built around how
          exam invigilation actually works.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}
