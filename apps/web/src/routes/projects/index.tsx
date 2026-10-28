import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return <h1 className="text-2xl font-bold">プロジェクト</h1>;
}
