import Reveal from "./Reveal";

/** Product guarantees, stated as numbers — each one is how Proctavo actually behaves. */
const FACTS = [
  { value: "0", label: "double-booked duties", note: "only one teacher can hold a room’s duty — the database enforces it" },
  { value: "3", label: "reminders per duty", note: "three days, one day and 30 minutes before" },
  { value: "1 tap", label: "to confirm", note: "one click in the email (no login), or one tap in the app" },
  { value: "4", label: "roles, one roster", note: "CS, DCS, RS and invigilators each see their part" },
];

export default function ProofRow() {
  return (
    <section className="border-y border-[#e6e1d6] bg-[#efebe3]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 sm:px-8 lg:grid-cols-4">
        {FACTS.map((f, i) => (
          <Reveal key={f.label} delay={i * 80}>
            <p className="font-editorial text-5xl leading-none text-[#17151f]">{f.value}</p>
            <p className="mt-3 font-landing text-[15px] font-medium text-[#17151f]">{f.label}</p>
            <p className="mt-1 font-landing text-[13px] leading-snug text-[#7a7484]">{f.note}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
