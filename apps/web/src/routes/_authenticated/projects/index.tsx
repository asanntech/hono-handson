import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return <h1 className="text-2xl font-bold">プロジェクト</h1>;
}
