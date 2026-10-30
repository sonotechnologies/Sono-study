/** "gst 111", "GST-111", "Gst111" → "GST111". Returns null when it doesn't look like a course code. */
export function normaliseCourseCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s._-]+/g, "");
  return /^[A-Z]{2,4}\d{3}[A-Z]?$/.test(code) ? code : null;
}

/** Levels offered in onboarding. Polytechnics use ND/HND; we store them as 100–400. */
export const LEVELS = [100, 200, 300, 400, 500] as const;

export const POLY_LEVEL_LABEL: Record<number, string> = { 100: "ND1", 200: "ND2", 300: "HND1", 400: "HND2" };

export function levelLabel(level: number, schoolType?: string): string {
  return schoolType === "poly" ? (POLY_LEVEL_LABEL[level] ?? `${level}L`) : `${level}L`;
}

/** Common departments offered as suggestions; students can type any department. */
export const DEPARTMENTS = [
  "Accounting",
  "Agricultural Science",
  "Architecture",
  "Banking and Finance",
  "Biochemistry",
  "Biology",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Computer Engineering",
  "Computer Science",
  "Economics",
  "Education",
  "Electrical Engineering",
  "English",
  "Estate Management",
  "Geography",
  "History",
  "Law",
  "Marketing",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Medicine and Surgery",
  "Microbiology",
  "Nursing",
  "Pharmacy",
  "Philosophy",
  "Physics",
  "Political Science",
  "Psychology",
  "Public Administration",
  "Sociology",
  "Statistics",
] as const;
