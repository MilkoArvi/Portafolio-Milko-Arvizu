import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { Tinta } from "@/experiences/tinta/Tinta";

const p = bySlug("tinta")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><Tinta locale="es" /></main>
      <ProjectOutro slug="tinta" />
    </>
  );
}
