import { ProjectOutro } from "@/components/ProjectChrome";
import { Mike } from "@/experiences/mike/Mike";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("mike", "es");

export default function Page() {
  return (
    <>
      <main><Mike locale="es" /></main>
      <ProjectOutro slug="mike" />
    </>
  );
}
