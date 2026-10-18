"use client";

// Where the page stands (#104): saved to the account, saving, or only on this device. A 企业主页 is saved to the
// business (ADR 0022), and a member of its team only reads it.
import { Button } from "@/components/ui/Button";
import { initialProfile } from "@/components/seeker/hub-state";
import { useProfile, useProfileSave, type SaveState } from "@/components/seeker/profile-client";
import { useSession } from "@/components/seeker/session-client";

/**
 * The line under the page. `localSave`: whether the last change could be kept in this browser at all; `business`:
 * the page is a 企业主页.
 */
export function saveNote(state: SaveState, onAccount: boolean, localSave: boolean | null, business = false): string {
  if (localSave === false)
    return "没有保存：这个浏览器不让本站保存资料（可能是无痕模式或存储空间已满），刷新后改动会丢失。";
  if (!onAccount) return localSave ? "已自动保存到本机" : "资料只保存在这台设备上，改动会自动保存。";
  switch (state) {
    case "saving":
      return "正在保存…";
    case "saved":
      return business ? "已保存到企业主页，团队里的人和求职者都能看到。" : "已保存到你的账号，换一台设备登录也能看到。";
    case "readonly":
      return localSave ? "已自动保存到本机" : "企业主页由管理员修改；你的私密交换资料会自动保存在这台设备上。";
    case "offline":
      return "没连上服务器：改动先存在这台设备上，再改一次或下次打开时会再保存。";
    case "ask":
      return "先在上面选留哪一份。选好之前，改动只存在这台设备上。";
    default:
      return business ? "改动会自动保存到企业主页。" : "改动会自动保存到你的账号。";
  }
}

export function ProfileSaveNote({ localSave, className = "" }: { localSave: boolean | null; className?: string }) {
  const session = useSession();
  const { state, onAccount } = useProfileSave();
  const failed = localSave === false || (onAccount && state === "offline");
  return (
    <p role="status" className={`${className} text-meta ${failed ? "text-danger" : "text-muted"}`.trim()}>
      {saveNote(state, onAccount, localSave, session?.activeRole === "employer")}
    </p>
  );
}

/** When this device and the account each have a different page: the person keeps one. */
export function ProfileChoice() {
  const session = useSession();
  const { profile } = useProfile();
  const { account, keepAccount, keepDevice } = useProfileSave();
  if (!account?.profile) return null;
  // A 企业主页 is the business's (ADR 0022): what this device has meets what the team's page is now.
  const employer = session?.activeRole === "employer";
  const server = employer ? "企业主页现在的" : "账号里的";
  const summary = (page: { name?: string; headline?: string }) =>
    [page.name, page.headline].filter(Boolean).join(" · ") || "（没有填姓名）";
  return (
    <section
      aria-labelledby="profile-choice-title"
      className="space-y-3 rounded-md border border-brand/40 bg-brand-soft p-4"
    >
      <h2 id="profile-choice-title" className="text-body font-semibold">
        {employer ? "这台设备上的主页和企业主页现在的不一样" : "这台设备上的主页和你账号里的不一样"}
      </h2>
      <dl className="grid gap-1 text-meta sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-muted">{server}</dt>
        <dd>{summary({ ...initialProfile(session), ...account.profile })}</dd>
        <dt className="text-muted">这台设备上的</dt>
        <dd>{summary(profile)}</dd>
      </dl>
      <p className="text-meta text-muted">留下一份，另一份会被它替换。</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={keepAccount}>用{server}</Button>
        <Button variant="secondary" onClick={keepDevice}>
          用这台设备上的
        </Button>
      </div>
    </section>
  );
}
