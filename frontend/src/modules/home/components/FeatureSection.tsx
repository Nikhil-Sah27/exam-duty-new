import {
  Bell,
  CalendarCheck,
  Layers,
  MessagesSquare,
  ArrowLeftRight,
  Scale,
} from "lucide-react";
import FeatureCard, { type Feature } from "./FeatureCard";

const FEATURES: Feature[] = [
  {
    icon: Scale,
    title: "Fair, computed targets",
    description:
      "Duty targets are calculated from real inputs — course load, student counts, room capacity — and split across designations so the workload is balanced, not guessed.",
  },
  {
    icon: Layers,
    title: "Room groups for RS & DCS",
    description:
      "Room Superintendents cover chunks of up to five rooms; DCS cover blocks sized by student count. Proctavo groups, assigns and counts them as one unit.",
  },
  {
    icon: ArrowLeftRight,
    title: "Change requests & swaps",
    description:
      "Teachers request a move, drop or swap; the Controller approves in one click. The same duty record updates everywhere — no double-booking.",
  },
  {
    icon: CalendarCheck,
    title: "Automatic calendar invites",
    description:
      "Every duty lands in the teacher's calendar as a proper invite — and updates or cancels itself when the assignment changes.",
  },
  {
    icon: MessagesSquare,
    title: "Direct messaging",
    description:
      "Teachers message the exam cell directly — complaints, questions, anything — with read receipts and replies, right inside Proctavo.",
  },
  {
    icon: Bell,
    title: "Reminders that land on time",
    description:
      "Duty-today alerts, target reminders and unread-message nudges keep every invigilator where they need to be on exam day.",
  },
];

/** Concrete capability grid — grounded in the exam-duty domain, not buzzwords. */
export default function FeatureSection() {
  return (
    <section id="features" className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
            What you get
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The whole invigilation workflow, in one place
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
