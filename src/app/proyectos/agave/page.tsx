import { ProjectOutro } from "@/components/ProjectChrome";
import { AgaveNegro } from "@/experiences/agave/AgaveNegro";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("agave", "es");

export default function Page() {
  return (
    <>
      <main><AgaveNegro locale="es" /></main>
      <ProjectOutro slug="agave" />
    </>
  );
}
