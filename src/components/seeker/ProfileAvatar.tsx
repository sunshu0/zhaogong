"use client";

import { buttonClass } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { useCandidateDirectory, usePublicEmployerProfile } from "@/components/seeker/hub-client";
import type { Conversation } from "@/components/seeker/chat-client";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

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
      lang={contentLang(fallback)}
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
  const t = useMessages(seekerProfileMessages).avatar;
  const profile = usePublicEmployerProfile(employerId);
  return <AvatarImage avatar={profile?.avatar} fallback={fallback} alt={t.alt(fallback)} large={large} />;
}

export function CounterpartAvatar({ conversation, isEmployer }: { conversation: Conversation; isEmployer: boolean }) {
  const t = useMessages(seekerProfileMessages).avatar;
  const { candidates } = useCandidateDirectory();
  const employer = usePublicEmployerProfile(conversation.employerId ?? "");
  const candidateId =
    conversation.candidateId ??
    (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id);
  const candidate = isEmployer ? candidates.find((item) => item.id === candidateId) : undefined;
  return (
    <AvatarImage
      avatar={isEmployer ? candidate?.avatar : employer?.avatar}
      fallback={conversation.avatar || conversation.person}
      alt={t.alt(conversation.person)}
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
  const t = useMessages(seekerProfileMessages).avatar;
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
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
      setError(t.tooBig);
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
      if (onChange(avatar) !== true) setError(t.noRoom);
    } catch {
      if (token === request.current) setError(t.unreadable);
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AvatarImage avatar={value} fallback={fallback} alt={t.preview} large />
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <button
            ref={uploadButton}
            type="button"
            onClick={() => inputRef.current?.click()}
            className={buttonClass("secondary")}
            {...busyProps(busy)}
          >
            <Camera aria-hidden="true" className="size-4" />
            {busy ? t.working : t.upload}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                const removed = onChange(undefined) === true;
                setError(removed ? "" : t.removeFailed);
                if (removed) uploadButton.current?.focus(); // 移除头像 goes away with the photo (#202)
              }}
              className="min-h-11 text-sm text-muted underline aria-disabled:opacity-50"
              {...busyProps(busy)}
            >
              {t.remove}
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
          aria-label={t.choose}
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
