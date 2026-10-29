import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await api.projects.$get();
      // hc は 4xx / 5xx でも例外を投げない。失敗を TanStack Query のエラーとして扱うため、自分で投げる
      if (!res.ok) {
        throw new Error("プロジェクトを取得できませんでした");
      }
      return res.json();
    },
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">プロジェクト</h1>
      {projects.data?.length === 0 ? (
        <p className="text-muted-foreground">プロジェクトがありません</p>
      ) : (
        <ul className="grid gap-2">
          {projects.data?.map((project) => (
            <li key={project.id}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="block rounded-lg border p-4 hover:bg-muted"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
