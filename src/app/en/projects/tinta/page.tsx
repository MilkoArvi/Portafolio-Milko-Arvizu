import { ProjectOutro } from "@/components/ProjectChrome";
import { Tinta } from "@/experiences/tinta/Tinta";
import { projectMetadata } from "@/lib/pages";

export const metadata = projectMetadata("tinta", "en");

export default function Page() {
  return (
    <>
      <main><Tinta locale="en" /></main>
      <ProjectOutro slug="tinta" />
    </>
  );
}
