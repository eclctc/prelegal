import { readFile } from "node:fs/promises";
import path from "node:path";
import AuthGate from "@/components/AuthGate";
import AppShell from "@/components/AppShell";
import type { DocumentSpec } from "@/lib/documents";

// The Common Paper templates and documents.json live at the repo root and are the single source
// of truth. Override the location with REPO_ROOT when `frontend/` is not run from inside the repo.
const REPO_ROOT = process.env.REPO_ROOT ?? path.join(process.cwd(), "..");

export default async function Home() {
  const documents: DocumentSpec[] = JSON.parse(await readFile(path.join(REPO_ROOT, "documents.json"), "utf8"));
  const entries = await Promise.all(
    documents.map(async (d) => [d.id, await readFile(path.join(REPO_ROOT, "templates", d.template), "utf8")] as const),
  );
  return (
    <AuthGate>
      <AppShell documents={documents} templates={Object.fromEntries(entries)} />
    </AuthGate>
  );
}
