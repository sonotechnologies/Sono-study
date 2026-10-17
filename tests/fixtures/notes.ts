import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Lecture notes for pipeline tests and the milestone 3 acceptance run:
 * GST 111-style notes, 5 topics × 4 pages, every sentence different.
 */

const TOPICS: { name: string; facts: [string, string][] }[] = [
  {
    name: "Barriers to communication",
    facts: [
      ["noise", "any interference that distorts a message between sender and receiver"],
      ["semantic barriers", "differences in the meanings people attach to the same words"],
      ["physical barriers", "obstacles such as distance, poor lighting and faulty equipment"],
      ["psychological barriers", "states like anxiety, anger and prejudice that block open listening"],
      ["cultural barriers", "clashes between the customs and values of sender and receiver"],
      ["information overload", "receiving more messages than a person can process at once"],
      ["filtering", "the sender shaping information so it looks more favourable to the receiver"],
      ["jargon", "specialised vocabulary that outsiders to a profession cannot follow"],
      ["status differences", "gaps in rank that discourage juniors from speaking freely"],
      ["perception", "the personal lens through which each listener interprets a message"],
    ],
  },
  {
    name: "Listening skills",
    facts: [
      ["hearing", "the physical process of sound waves reaching the ear"],
      ["active listening", "concentrating, understanding, responding to and remembering what is said"],
      ["selective listening", "attending only to the parts of a message the listener agrees with"],
      ["feedback", "the response that shows the speaker how the message was received"],
      ["paraphrasing", "restating the speaker's idea in the listener's own words"],
      ["empathetic listening", "listening to understand the feelings behind the speaker's words"],
      ["critical listening", "evaluating the evidence and logic of what a speaker says"],
      ["pseudo-listening", "pretending to pay attention while thinking about something else"],
      ["note-taking", "recording the main points of a lecture for later review"],
      ["attention span", "the length of time a listener can concentrate without drifting"],
    ],
  },
  {
    name: "Parts of speech",
    facts: [
      ["noun", "a word that names a person, place, thing or idea"],
      ["pronoun", "a word used in place of a noun to avoid repeating it"],
      ["adjective", "a word that describes or qualifies a noun"],
      ["adverb", "a word that modifies a verb, an adjective or another adverb"],
      ["preposition", "a word that shows the relationship between a noun and other words"],
      ["conjunction", "a word that joins words, phrases or clauses together"],
      ["interjection", "a word that expresses sudden feeling, such as alas"],
      ["determiner", "a word such as the, a or this that introduces a noun"],
      ["auxiliary verb", "a helping verb such as have or will used with a main verb"],
      ["gerund", "the -ing form of a verb used as a noun"],
    ],
  },
  {
    name: "Concord",
    facts: [
      ["subject-verb concord", "the rule that a verb agrees with its subject in number"],
      ["notional concord", "agreement based on the meaning of the subject rather than its form"],
      ["proximity concord", "agreement with the nearest noun in a subject joined by either or neither"],
      ["collective nouns", "names of groups that take a singular verb when the group acts as one"],
      ["indefinite pronouns", "words like everyone and nobody that take singular verbs"],
      ["compound subjects", "two subjects joined by and that usually take a plural verb"],
      ["pronoun-antecedent agreement", "the rule that a pronoun matches the noun it replaces"],
      ["uncountable nouns", "nouns such as information and furniture that take singular verbs"],
      ["plural-form nouns", "nouns such as mathematics and news that look plural but are singular"],
      ["intervening phrases", "words between subject and verb that do not change the verb's number"],
    ],
  },
  {
    name: "Essay writing",
    facts: [
      ["thesis statement", "the sentence that states the central argument of the essay"],
      ["topic sentence", "the opening sentence that states the main idea of a paragraph"],
      ["outline", "a plan that arranges ideas from main headings to supporting details"],
      ["coherence", "the logical flow that connects one idea to the next"],
      ["cohesion", "the use of linking words that bind sentences together"],
      ["conclusion", "the final paragraph that restates the thesis and closes the argument"],
      ["argumentative essay", "an essay that defends a position with evidence"],
      ["expository essay", "an essay that explains a subject clearly and objectively"],
      ["narrative essay", "an essay that tells a story in a logical sequence of events"],
      ["proofreading", "checking the final draft for errors in spelling and grammar"],
    ],
  },
];

const TEMPLATES = [
  (t: string, d: string) => `In communication studies, ${t} is defined as ${d}.`,
  (t: string, d: string) => `Lecturers describe ${t} as ${d}, and examiners often test it.`,
  (t: string, d: string) => `Students should remember that ${t} means ${d}.`,
  (t: string, d: string) => `A common exam definition of ${t} is ${d}.`,
];

/** Page text for n pages (4 pages per topic). */
export function notesPages(n = 20): { heading: string; lines: string[] }[] {
  const pages = [];
  for (let p = 0; p < n; p++) {
    const topic = TOPICS[Math.floor(p / 4) % TOPICS.length];
    const page = p % 4;
    const lines = [];
    for (let k = 0; k < 8; k++) {
      const idx = page * 8 + k;
      const [term, def] = topic.facts[idx % topic.facts.length];
      lines.push(TEMPLATES[Math.floor(idx / topic.facts.length) % TEMPLATES.length](term, def));
    }
    pages.push({ heading: topic.name, lines });
  }
  return pages;
}

function wrap(text: string, width = 88): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (line && line.length + w.length + 1 > width) {
      out.push(line);
      line = "";
    }
    line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/** A real PDF with selectable text (what students export from slides or Word). */
export async function makeNotesPdf(n = 20): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of notesPages(n)) {
    const pdfPage = doc.addPage([595, 842]);
    let y = 790;
    pdfPage.drawText(page.heading, { x: 50, y, size: 18, font: bold });
    y -= 34;
    for (const para of page.lines) {
      for (const l of wrap(para)) {
        pdfPage.drawText(l, { x: 50, y, size: 11, font });
        y -= 16;
      }
      y -= 8;
    }
  }
  return doc.save();
}

/** Six pages, each fact on exactly one page: for checking the tutor cites the right page. */
export const TUTOR_PAGES: { heading: string; lines: string[] }[] = [
  { heading: "Course outline", lines: ["This course covers listening, barriers to communication, concord and essay writing.", "Attendance at tutorials is compulsory for the continuous assessment."] },
  { heading: "Hearing and listening", lines: ["Hearing is the passive, physical process of sound waves reaching the ear.", "Listening is deliberate: the listener pays attention, interprets and responds."] },
  { heading: "Stages of listening", lines: ["The four stages of listening are receiving, understanding, evaluating and responding.", "Feedback in the responding stage shows the speaker how the message was received."] },
  { heading: "Semantic noise", lines: ["Semantic noise happens when the sender and receiver attach different meanings to the same words.", "Jargon, slang and ambiguous words are common causes of semantic noise."] },
  { heading: "Subject-verb concord", lines: ["Subject-verb concord is the rule that a verb agrees with its subject in number.", "Collective nouns take a singular verb when the group acts as one unit."] },
  { heading: "Thesis statements", lines: ["A thesis statement is the sentence that states the central argument of an essay.", "It usually comes at the end of the introductory paragraph."] },
];

export async function makeTutorPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of TUTOR_PAGES) {
    const p = doc.addPage([595, 842]);
    let y = 790;
    p.drawText(page.heading, { x: 50, y, size: 18, font: bold });
    y -= 34;
    for (const para of page.lines) {
      for (const l of wrap(para)) {
        p.drawText(l, { x: 50, y, size: 11, font });
        y -= 16;
      }
      y -= 8;
    }
  }
  return doc.save();
}
