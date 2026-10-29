import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { Barro } from "@/experiences/barro/Barro";

const p = bySlug("barro")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><Barro locale="es" /></main>
      <ProjectOutro slug="barro" />
    </>
  );
}
