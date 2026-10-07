import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

const ROLES = [
  {
    name: "CS",
    full: "Controller of Superintendents",
    tag: "the exam cell",
    body: "Creates exams, assigns duties, approves change requests and sees the whole plan — including who’s confirmed and who isn’t.",
  },
  {
    name: "DCS",
    full: "Deputy Chief Superintendent",
    tag: "blocks",
    body: "Supervises a block of rooms sized by student count, and the invigilators working in it.",
  },
  {
    name: "RS",
    full: "Room Superintendent",
    tag: "≤ 5 rooms",
    body: "Covers a group of up to five rooms per building and slot — claimed, reminded and counted as one duty.",
  },
  {
    name: "Invigilator",
    full: "Single-room duty",
    tag: "one room",
    body: "Picks their own rooms or takes what’s assigned, confirms in one tap, and asks for a swap when life happens.",
  },
];

/** The four roles Proctavo is built around. */
export default function RoleSection() {
  return (
    <section id="roles" className="scroll-mt-20 border-t border-[#e6e1d6] bg-[#efebe3]">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <Eyebrow>One roster, four roles</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-editorial text-5xl leading-[1.02] text-[#17151f] sm:text-6xl">
            Everyone sees <span className="italic text-indigo-600">their</span> part — and nothing more.
          </h2>
          <p className="mt-5 max-w-2xl font-landing text-[16px] leading-relaxed text-[#5a5466]">
            Roles follow from each person’s designation — nobody assigns them by hand. Teachers see “Occupied”, not
            names; only the exam cell sees who holds each duty.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <Reveal key={r.name} delay={i * 90}>
              <article className="flex h-full flex-col rounded-2xl bg-[#fbfaf7] p-6 ring-1 ring-[#e3ddd1]">
                <span className="self-start rounded-full bg-[#17151f] px-2.5 py-1 font-landing-mono text-[10px] uppercase tracking-[0.16em] text-white">
                  {r.tag}
                </span>
                <h3 className="mt-6 font-editorial text-4xl leading-none text-[#17151f]">{r.name}</h3>
                <p className="mt-2 font-landing text-[13px] font-medium text-indigo-600">{r.full}</p>
                <p className="mt-4 font-landing text-[14.5px] leading-relaxed text-[#5a5466]">{r.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
