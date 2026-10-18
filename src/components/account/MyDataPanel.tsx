"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMyAccount, myServerData } from "@/app/[lang]/account/actions";
import { confirmsEmail, forgetLocalData, localDataFor, myDataFile, myDataFileName } from "@/components/account/my-data";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { inputClass } from "@/components/ui/input-class";

/** Where deleting sends the browser: a full load, so nothing of the account stays in this page's memory. */
export const DELETED_HREF = "/account/data?deleted=1";

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 数据与账号 (#54, R-30): download everything about the account, or delete it. Round 19: cards, red buttons. */
export function MyDataPanel() {
  const session = useSession();
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  if (!session) return null;
  const email = session.email;

  async function exportData() {
    setExporting(true);
    setExportResult(null);
    try {
      const answer = await myServerData();
      if (!answer.ok) return setExportResult({ ok: false, text: answer.error });
      const now = new Date();
      const file = myDataFile(answer.data, localDataFor(localStorage, email), now);
      download(myDataFileName(now), JSON.stringify(file, null, 2));
      setExportResult({ ok: true, text: `已下载 ${myDataFileName(now)}` });
    } catch {
      setExportResult({ ok: false, text: "导出没有成功，请稍后再试" });
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      const answer = await deleteMyAccount(typed);
      if (!answer.ok) return setDeleteError(answer.error);
      forgetLocalData(localStorage, email);
      // A full load on purpose: the page's in-memory copies (chats, profile) must not outlive the account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(DELETED_HREF);
    } catch {
      setDeleteError("删除没有成功，请稍后再试");
    } finally {
      setDeleting(false);
    }
  }

  const confirmed = confirmsEmail(typed, email);

  return (
    <div className="space-y-section">
      <Section
        look="app"
        id="export-data"
        title="导出我的数据"
        description="下载一个 JSON 文件，包含我们保存的关于你的全部数据：账号、求职和雇主两种身份的资料、发布的职位、聊天记录、已读通知、收藏和求职进度、职位提醒、举报和浏览记录。"
      >
        <div className="space-y-3 py-group">
          <p className="text-meta text-muted">
            资料、举报和浏览记录有一部分只存在这台设备上；在别的设备上导出，文件里会少这一部分。
          </p>
          <Button variant="secondary" onClick={() => void exportData()} loading={exporting}>
            {exporting ? "正在导出…" : "下载我的数据"}
          </Button>
          {exportResult && (
            <p role="status" className={`text-meta ${exportResult.ok ? "text-ok" : "text-danger"}`}>
              {exportResult.text}
            </p>
          )}
        </div>
      </Section>

      <Section look="app" id="delete-account" title="删除账号">
        <form
          className="space-y-3 py-group"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed && !deleting) void deleteAccount();
          }}
        >
          <ul className="list-disc space-y-1 pl-5 text-body">
            <li>
              删除账号、登录记录、两种身份的聊天记录和已读通知、收藏和求职进度、职位提醒，以及这台设备上的资料、举报和浏览记录。
            </li>
            <li>雇主身份发布的职位全部下架，职位上的联系方式一并清除。</li>
            <li>
              店铺本身、举报和审核记录、联系方式的查看次数会保留，但不再带你的邮箱：这些记录关系到其他用户和平台安全。
            </li>
            <li>和你聊过天的人，他们自己那份聊天记录不会删除。</li>
            <li>删除后立刻退出登录，不能恢复。以后可以用同一个邮箱重新注册，会是一个新账号。</li>
          </ul>
          <label className="block space-y-1">
            <span className="text-body">
              输入你的登录邮箱 <span className="font-medium break-all">{email}</span> 确认
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={deleteError ? true : undefined}
              aria-describedby={deleteError ? "delete-account-error" : undefined}
              className={inputClass({ tone: deleteError ? "danger" : undefined })}
            />
          </label>
          {deleteError && (
            <p
              id="delete-account-error"
              role="alert"
              className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger"
            >
              {deleteError}
            </p>
          )}
          <Button type="submit" variant="danger" disabled={!confirmed} loading={deleting}>
            {deleting ? "正在删除…" : "永久删除账号"}
          </Button>
        </form>
      </Section>
    </div>
  );
}

/** After 删除账号: says what happened. Someone signed in who opens the address gets the normal page instead. */
export function AccountDeleted() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  useEffect(() => {
    if (hydrated && session) router.replace("/account/data");
  }, [hydrated, session, router]);
  return (
    <Section look="app">
      <div role="status" className="space-y-2 py-group">
        <p className="text-title font-semibold">账号已删除</p>
        <p className="text-body">
          你已经退出登录。账号、聊天记录和这台设备上的资料都已清除；开通过雇主身份的，发布的职位也已下架。
        </p>
        <ButtonLink href="/jobs" className="mt-2">
          去看职位
        </ButtonLink>
      </div>
    </Section>
  );
}
