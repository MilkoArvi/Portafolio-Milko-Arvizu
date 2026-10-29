import { ProjectOutro } from "@/components/ProjectChrome";
import { AgaveNegro } from "@/experiences/agave/AgaveNegro";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("agave", "en");

export default function Page() {
  return (
    <>
      <main><AgaveNegro locale="en" /></main>
      <ProjectOutro slug="agave" />
    </>
  );
}
