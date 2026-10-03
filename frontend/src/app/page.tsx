import { readFile } from "node:fs/promises";
import path from "node:path";
import NdaApp from "@/components/NdaApp";

// The Common Paper templates live at the repo root and are the single source of truth.
// Override the location with TEMPLATES_DIR when `frontend/` is not run from inside the repo.
const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? path.join(process.cwd(), "..", "templates");
const TEMPLATE_PATH = path.join(TEMPLATES_DIR, "Mutual-NDA.md");

export default async function Home() {
  const standardTerms = await readFile(TEMPLATE_PATH, "utf8");
  return <NdaApp standardTerms={standardTerms} />;
}
