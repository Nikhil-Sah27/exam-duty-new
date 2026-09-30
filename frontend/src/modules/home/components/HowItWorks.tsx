const STEPS = [
  {
    n: "01",
    title: "Set up exams, rooms & faculty",
    body: "Add departments, semesters and student counts, your rooms across each building, and your teaching staff. Roles (DCS, RS, Invigilator) are derived from each person's designation — no manual role juggling.",
  },
  {
    n: "02",
    title: "Proctavo computes fair duty targets",
    body: "From the timetable and room capacities it works out how many duties each teacher should do, splitting the load across Professors, Associate and Assistant Professors — so no one is over- or under-loaded.",
  },
  {
    n: "03",
    title: "Assign, swap, and keep everyone in sync",
    body: "The Controller assigns duties (or teachers self-claim), handles change requests and swaps, and Proctavo emails calendar invites, reminders and duty updates automatically.",
  },
];

/** Concrete three-step explanation of the product. */
export default function HowItWorks() {
  return (
    <section id="how" className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            From timetable to invigilation roster
          </h2>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="text-4xl font-black text-white/10">{s.n}</span>
              <h3 className="mt-2 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
