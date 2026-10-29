import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { Rostro } from "@/experiences/rostro/Rostro";

const p = bySlug("rostro")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><Rostro /></main>
      <ProjectOutro slug="rostro" />
    </>
  );
}
