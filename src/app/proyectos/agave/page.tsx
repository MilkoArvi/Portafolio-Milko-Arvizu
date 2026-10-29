import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { AgaveNegro } from "@/experiences/agave/AgaveNegro";

const p = bySlug("agave")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><AgaveNegro locale="es" /></main>
      <ProjectOutro slug="agave" />
    </>
  );
}
