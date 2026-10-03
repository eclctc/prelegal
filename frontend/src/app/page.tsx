import { readFile } from "node:fs/promises";
import path from "node:path";
import NdaApp from "@/components/NdaApp";

// The Common Paper templates live at the repo root and are the single source of truth.
const TEMPLATE_PATH = path.join(process.cwd(), "..", "templates", "Mutual-NDA.md");

export default async function Home() {
  const standardTerms = await readFile(TEMPLATE_PATH, "utf8");
  return <NdaApp standardTerms={standardTerms} />;
}
