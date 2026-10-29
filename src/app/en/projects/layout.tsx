import { IdleHint, ProjectBar, ProjectDock } from "@/components/ProjectChrome";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProjectBar />
      {children}
      <ProjectDock />
      <IdleHint />
    </>
  );
}
