import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Set up exams, rooms and faculty",
    body: "Departments, semesters and student counts; rooms across every building; your teaching staff. Roles — DCS, RS, invigilator — follow from each person’s designation, so nobody juggles them by hand.",
  },
  {
    n: "02",
    title: "Proctavo works out fair targets",
    body: "From the timetable and room capacities it computes how many duties each teacher should do, split across Professors, Associate and Assistant Professors — nobody over- or under-loaded.",
  },
  {
    n: "03",
    title: "Assign, swap — and everyone stays in sync",
    body: "The exam cell assigns in a click or teachers claim their own. Change requests and swaps are one approval. Calendars, reminders and every open page update on their own.",
  },
];

/** Three steps from timetable to roster. */
export default function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-editorial text-5xl leading-[1.02] text-[#17151f] sm:text-6xl">
            From timetable to roster, <span className="italic text-indigo-600">without the spreadsheet</span>.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="border-t border-[#d9d3c6] pt-6">
                <p className="font-landing-mono text-[12px] text-indigo-600">{s.n}</p>
                <h3 className="mt-4 font-landing text-xl font-semibold leading-snug text-[#17151f]">{s.title}</h3>
                <p className="mt-3 font-landing text-[15px] leading-relaxed text-[#5a5466]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
