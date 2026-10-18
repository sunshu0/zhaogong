"use client";

// 重复职位提醒 (#196): before publishing, says that the business already has a live job with this title, and links
// to it — renewing or editing that one is usually what the employer wants. A hint; publishing goes on as before.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyLiveJobsTitled, type JobTwin } from "@/app/[lang]/employer/actions";
import { closeDateZh } from "@/components/employer/job-status";

/** Asks the server once the title has stopped changing for a moment. */
function useLiveTwins(titleZh: string): JobTwin[] {
  const [found, setFound] = useState<{ title: string; twins: JobTwin[] }>();
  useEffect(() => {
    if (!titleZh.trim()) return;
    let live = true;
    const timer = setTimeout(() => {
      getMyLiveJobsTitled(titleZh)
        .then((twins) => {
          if (live) setFound({ title: titleZh, twins });
        })
        .catch(() => {});
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [titleZh]);
  return found?.title === titleZh && titleZh.trim() ? found.twins : [];
}

export function DuplicateJobNote({ titleZh }: { titleZh: string }) {
  const twins = useLiveTwins(titleZh);
  const first = twins[0];
  if (!first) return null;
  const more = twins.length > 1 ? `等 ${twins.length} 条` : "";
  const when = first.status === "pending_review" ? "（审核中）" : `（${closeDateZh(first.expiresAt)}截止）`;
  return (
    <p className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">
      你已经有一条在招的「{first.titleZh}」{when}
      {more}。要多招几个人，续期或编辑那条就行；确实是另一份工（比如另一家门店、另一个班次），照常发布。
      <Link href={`/employer/jobs/${first.id}`} className="ml-1 font-medium text-brand underline underline-offset-4">
        去看看那条
      </Link>
    </p>
  );
}
