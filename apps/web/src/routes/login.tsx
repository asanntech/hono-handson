import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, toApiError } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useMutation({
    mutationFn: async (json: { email: string; password: string }) => {
      const res = await api.auth.login.$post({ json });
      if (!res.ok) {
        throw await toApiError(res);
      }
      return res.json();
    },
    onSuccess: () => navigate({ to: "/projects" }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">パスワード</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {login.error && (
            <p role="alert" className="text-sm text-destructive">
              {login.error.message}
            </p>
          )}
          <Button type="submit" disabled={login.isPending}>
            ログイン
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
