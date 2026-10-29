import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { Mike } from "@/experiences/mike/Mike";

const p = bySlug("mike")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><Mike /></main>
      <ProjectOutro slug="mike" />
    </>
  );
}
