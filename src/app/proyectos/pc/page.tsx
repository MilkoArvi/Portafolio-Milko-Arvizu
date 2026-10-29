import type { Metadata } from "next";
import { bySlug } from "@/data/projects";
import { ProjectOutro } from "@/components/ProjectChrome";
import { PcBuild } from "@/experiences/pc/PcBuild";

const p = bySlug("pc")!;
export const metadata: Metadata = { title: p.title, description: p.summary };

export default function Page() {
  return (
    <>
      <main><PcBuild /></main>
      <ProjectOutro slug="pc" />
    </>
  );
}
