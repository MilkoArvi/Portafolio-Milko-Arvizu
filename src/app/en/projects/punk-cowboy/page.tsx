import { ProjectOutro } from "@/components/ProjectChrome";
import { PunkCowboy } from "@/experiences/punk/PunkCowboy";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("punk-cowboy", "en");

export default function Page() {
  return (
    <>
      <main><PunkCowboy locale="en" /></main>
      <ProjectOutro slug="punk-cowboy" />
    </>
  );
}
