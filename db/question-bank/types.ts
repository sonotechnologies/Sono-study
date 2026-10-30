/** Compact authoring format for the sample question bank (brief: 300 sample questions, doubles as a demo). */
export type BankQuestion =
  | { t: "single"; topic: string; d: 1 | 2 | 3; stem: string; options: string[]; correct: number; why: string; past?: boolean }
  | { t: "multiple"; topic: string; d: 1 | 2 | 3; stem: string; options: string[]; correct: number[]; why: string }
  | { t: "true_false"; topic: string; d: 1 | 2 | 3; stem: string; correct: boolean; why: string }
  | { t: "fill_in"; topic: string; d: 1 | 2 | 3; stem: string; accepted: string[]; why: string };

export const mc = (topic: string, d: 1 | 2 | 3, stem: string, options: string[], correct: number, why: string): BankQuestion => ({ t: "single", topic, d, stem, options, correct, why });
export const multi = (topic: string, d: 1 | 2 | 3, stem: string, options: string[], correct: number[], why: string): BankQuestion => ({ t: "multiple", topic, d, stem, options, correct, why });
export const tf = (topic: string, d: 1 | 2 | 3, stem: string, correct: boolean, why: string): BankQuestion => ({ t: "true_false", topic, d, stem, correct, why });
export const fill = (topic: string, d: 1 | 2 | 3, stem: string, accepted: string[], why: string): BankQuestion => ({ t: "fill_in", topic, d, stem, accepted, why });
