import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { PunkCowboy } from "@/experiences/punk/PunkCowboy";

const p = bySlug("punk-cowboy")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><PunkCowboy /></main>
      <ProjectOutro slug="punk-cowboy" />
    </>
  );
}
