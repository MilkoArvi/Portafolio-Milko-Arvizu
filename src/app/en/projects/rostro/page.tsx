import { ProjectOutro } from "@/components/ProjectChrome";
import { Rostro } from "@/experiences/rostro/Rostro";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("rostro", "en");

export default function Page() {
  return (
    <>
      <main><Rostro locale="en" /></main>
      <ProjectOutro slug="rostro" />
    </>
  );
}
