/** Seeds demo schools, courses, classmates, leaderboards and challenges. Usage: npm run db:seed */
import "dotenv/config";
import { getDb } from "../db";
import { seedIfEmpty } from "../db/seed";

const db = await getDb();
console.log((await seedIfEmpty(db)) ? "Seeded demo data." : "Database already has data; skipped.");
process.exit(0);
