import { ProjectOutro } from "@/components/ProjectChrome";
import { Barro } from "@/experiences/barro/Barro";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("barro", "en");

export default function Page() {
  return (
    <>
      <main><Barro locale="en" /></main>
      <ProjectOutro slug="barro" />
    </>
  );
}
