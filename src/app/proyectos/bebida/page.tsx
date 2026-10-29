import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { Bebida } from "@/experiences/bebida/Bebida";

const p = bySlug("bebida")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><Bebida /></main>
      <ProjectOutro slug="bebida" />
    </>
  );
}
