import {
  infiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ApiError, api, toApiError } from "@/lib/api";

// loader とコンポーネントで同じ queryKey を使い、loader が読み込んだ最初のページをコンポーネントが使えるようにする
const tasksQueryOptions = (projectId: string) =>
  infiniteQueryOptions({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async ({ pageParam }) => {
      const res = await api.projects[":projectId"].tasks.$get({
        param: { projectId },
        query: { cursor: pageParam },
      });
      if (!res.ok) {
        throw await toApiError(res);
      }
      return res.json();
    },
    // 最初のページはカーソルなしで取る。以降は、前のページが返した nextCursor をそのまま送り返す
    initialPageParam: undefined as string | undefined,
    // undefined を返すと、次のページはないと判断される（hasNextPage が false になる）
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  // 最初のページがキャッシュにそろうまで、画面を描画しない
  loader: ({ context, params }) =>
    context.queryClient.ensureInfiniteQueryData(
      tasksQueryOptions(params.projectId),
    ),
  // loader が投げたエラーは、component ではなくここに届く
  errorComponent: ({ error }) =>
    // メンバーでない場合も、プロジェクトが存在しない場合も、API は同じ 404 を返す
    error instanceof ApiError && error.status === 404 ? (
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold">タスク</h1>
        <p className="text-muted-foreground">プロジェクトが見つかりません</p>
      </div>
    ) : (
      <ErrorComponent error={error} />
    ),
  component: TasksPage,
});

const STATUS_LABELS = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
} as const;

function TasksPage() {
  const { projectId } = Route.useParams();
  // loader の後なので data は必ずある（useInfiniteQuery と違い undefined にならない）
  const tasks = useSuspenseInfiniteQuery(tasksQueryOptions(projectId));

  // 読み込んだページのタスクを、1 つの一覧としてつなげる
  const items = tasks.data.pages.flatMap((page) => page.items);

  // 一覧の末尾に置いた要素が画面に入ったら、次のページを読み込む
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { fetchNextPage } = tasks;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        fetchNextPage();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">タスク</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground">タスクがありません</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((task) => (
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
      )}
      <div ref={sentinelRef} />
    </div>
  );
}
