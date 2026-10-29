import { ProjectOutro } from "@/components/ProjectChrome";
import { PcBuild } from "@/experiences/pc/PcBuild";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("pc", "en");

export default function Page() {
  return (
    <>
      <main><PcBuild locale="en" /></main>
      <ProjectOutro slug="pc" />
    </>
  );
}
