import { ProjectOutro } from "@/components/ProjectChrome";
import { Barro } from "@/experiences/barro/Barro";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("barro", "es");

export default function Page() {
  return (
    <>
      <main><Barro locale="es" /></main>
      <ProjectOutro slug="barro" />
    </>
  );
}
