import { ProjectOutro } from "@/components/ProjectChrome";
import { PcBuild } from "@/experiences/pc/PcBuild";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("pc", "es");

export default function Page() {
  return (
    <>
      <main><PcBuild locale="es" /></main>
      <ProjectOutro slug="pc" />
    </>
  );
}
