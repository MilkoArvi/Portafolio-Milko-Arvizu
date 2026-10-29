import { ProjectOutro } from "@/components/ProjectChrome";
import { PunkCowboy } from "@/experiences/punk/PunkCowboy";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("punk-cowboy", "es");

export default function Page() {
  return (
    <>
      <main><PunkCowboy locale="es" /></main>
      <ProjectOutro slug="punk-cowboy" />
    </>
  );
}
