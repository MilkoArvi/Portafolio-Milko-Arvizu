import { ProjectOutro } from "@/components/ProjectChrome";
import { Bebida } from "@/experiences/bebida/Bebida";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("bebida", "es");

export default function Page() {
  return (
    <>
      <main><Bebida locale="es" /></main>
      <ProjectOutro slug="bebida" />
    </>
  );
}
