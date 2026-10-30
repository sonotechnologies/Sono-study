import { readFile } from "node:fs/promises";
import path from "node:path";

/** Space Grotesk / Inter for next/og share images, read from the bundled @fontsource packages (no network). */
type OgFont = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" };

const FILES: [name: string, pkg: string, file: string, weight: OgFont["weight"]][] = [
  ["Space Grotesk", "space-grotesk", "space-grotesk-latin-700-normal.woff", 700],
  ["Inter", "inter", "inter-latin-400-normal.woff", 400],
  ["Inter", "inter", "inter-latin-600-normal.woff", 600],
];

let cache: Promise<OgFont[]> | null = null;

export function ogFonts(): Promise<OgFont[]> {
  cache ??= Promise.all(
    FILES.map(async ([name, pkg, file, weight]) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file)),
    })),
  );
  return cache;
}
