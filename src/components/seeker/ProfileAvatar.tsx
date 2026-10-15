"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { useCandidateDirectory, usePublicEmployerProfile } from "@/components/seeker/hub-client";
import type { Conversation } from "@/components/seeker/chat-client";

export function AvatarImage({
  avatar,
  fallback,
  alt = "",
  large = false,
}: {
  avatar?: string;
  fallback: string;
  alt?: string;
  large?: boolean;
}) {
  return avatar ? (
    <Image
      src={avatar}
      alt={alt}
      width={large ? 64 : 40}
      height={large ? 64 : 40}
      unoptimized
      className={`shrink-0 rounded-full object-cover ${large ? "size-16" : "size-10"}`}
    />
  ) : (
    <span
      aria-hidden={alt ? undefined : "true"}
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand ${large ? "size-16 text-2xl" : "size-10 text-base"}`}
    >
      {fallback.slice(0, 1)}
    </span>
  );
}

export function EmployerAvatar({
  employerId,
  fallback,
  large = false,
}: {
  employerId: string;
  fallback: string;
  large?: boolean;
}) {
  const profile = usePublicEmployerProfile(employerId);
  return <AvatarImage avatar={profile?.avatar} fallback={fallback} alt={`${fallback}头像`} large={large} />;
}

export function CounterpartAvatar({ conversation, isEmployer }: { conversation: Conversation; isEmployer: boolean }) {
  const candidates = useCandidateDirectory();
  const employer = usePublicEmployerProfile(conversation.employerId ?? "");
  const candidateId =
    conversation.candidateId ??
    (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id);
  const candidate = isEmployer ? candidates.find((item) => item.id === candidateId) : undefined;
  return (
    <AvatarImage
      avatar={isEmployer ? candidate?.avatar : employer?.avatar}
      fallback={conversation.avatar || conversation.person}
      alt={`${conversation.person}头像`}
    />
  );
}

export function ProfileAvatarEditor({
  value,
  fallback,
  onChange,
}: {
  value?: string;
  fallback: string;
  onChange: (value?: string) => boolean | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function choose(file: File | undefined) {
    if (!file) return;
    const token = ++request.current;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setError("请选择 8MB 以内的图片。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const source = await createImageBitmap(file);
      const side = Math.min(source.width, source.height);
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, 320, 320);
      source.close();
      const avatar = canvas.toDataURL("image/webp", 0.82);
      if (avatar.length > 180_000) throw new Error("size");
      if (token !== request.current) return;
      if (onChange(avatar) !== true) setError("本机存储空间不足，头像未保存。");
    } catch {
      if (token === request.current) setError("图片无法读取，请换一张图片。");
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AvatarImage avatar={value} fallback={fallback} alt="头像预览" large />
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:border-brand disabled:opacity-50"
          >
            <Camera aria-hidden="true" className="size-4" />
            {busy ? "处理中…" : "上传头像"}
          </button>
          {value && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(onChange(undefined) === true ? "" : "头像移除失败，请重试。");
              }}
              className="min-h-11 text-sm text-muted underline disabled:opacity-50"
            >
              移除头像
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          aria-label="选择头像图片"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
