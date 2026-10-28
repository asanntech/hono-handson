import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: TasksPage,
});

function TasksPage() {
  return <h1 className="text-2xl font-bold">タスク</h1>;
}
