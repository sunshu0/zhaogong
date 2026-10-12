import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/seeker/LoginForm";
import { safeNext } from "@/components/seeker/session";

export const metadata: Metadata = { title: "注册或登录", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm pt-4">
      <h1 className="text-lg font-semibold">注册或登录</h1>
      <p className="mt-1 mb-4 text-sm text-muted">用邮箱验证码注册或登录，不用设密码。登录后可以查看雇主的电话、微信和邮箱。</p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  return <LoginForm next={safeNext((await searchParams).next)} />;
}
