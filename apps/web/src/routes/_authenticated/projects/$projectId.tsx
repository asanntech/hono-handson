import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: TasksPage,
});

const STATUS_LABELS = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
} as const;

function TasksPage() {
  const { projectId } = Route.useParams();
  const tasks = useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async () => {
      const res = await api.projects[":projectId"].tasks.$get({
        param: { projectId },
        query: {},
      });
      if (!res.ok) {
        throw new Error("タスクを取得できませんでした");
      }
      return res.json();
    },
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">タスク</h1>
      <ul className="grid gap-2">
        {tasks.data?.items.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <span>{task.title}</span>
            <span className="text-sm text-muted-foreground">
              {STATUS_LABELS[task.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
