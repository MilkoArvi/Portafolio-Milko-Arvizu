import { ProjectOutro } from "@/components/ProjectChrome";
import { Bebida } from "@/experiences/bebida/Bebida";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("bebida", "en");

export default function Page() {
  return (
    <>
      <main><Bebida locale="en" /></main>
      <ProjectOutro slug="bebida" />
    </>
  );
}
