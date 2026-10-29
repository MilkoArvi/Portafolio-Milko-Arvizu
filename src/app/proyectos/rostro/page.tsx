import { ProjectOutro } from "@/components/ProjectChrome";
import { Rostro } from "@/experiences/rostro/Rostro";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("rostro", "es");

export default function Page() {
  return (
    <>
      <main><Rostro locale="es" /></main>
      <ProjectOutro slug="rostro" />
    </>
  );
}
