import { ProjectOutro } from "@/components/ProjectChrome";
import { Tinta } from "@/experiences/tinta/Tinta";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("tinta", "es");

export default function Page() {
  return (
    <>
      <main><Tinta locale="es" /></main>
      <ProjectOutro slug="tinta" />
    </>
  );
}
