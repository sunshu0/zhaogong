import { aucklandDay } from "@/lib/chat-activity";

type Activity = { lastActiveAt: string; replies?: { candidateId: string; sentAt: string }[] };
const createdAt = Date.now();
const ago = (minutes: number) => new Date(createdAt - minutes * 60_000).toISOString();
// Demo replies count as "today": one that would fall before Auckland midnight is moved to just before start-up.
const replyAgo = (minutes: number) => {
  const sentAt = ago(minutes);
  return aucklandDay(Date.parse(sentAt)) === aucklandDay(createdAt) ? sentAt : ago(0);
};

// Fictional activity stays fixed while the preview is open, so relative times can age.
const employers: Record<string, Activity> = Object.fromEntries(
  [
    ["e1", 35, 4],
    ["e2", 10, 6],
    ["e3", 90, 3],
    ["e4", 180, 2],
    ["e5", 1500, 0],
    ["e6", 50, 5],
    ["e7", 20, 7],
    ["e8", 1440, 0],
  ].map(([id, minutes, count]) => [
    id,
    {
      lastActiveAt: ago(Number(minutes)),
      replies: Array.from({ length: Number(count) }, (_, index) => ({
        candidateId: `demo-person-${index}`,
        sentAt: replyAgo(Number(minutes) + index),
      })),
    },
  ]),
);
const candidates: Record<string, Activity> = {
  "candidate-lin": { lastActiveAt: ago(5) },
  "candidate-chen": { lastActiveAt: ago(120) },
  "candidate-wang": { lastActiveAt: ago(1500) },
  "candidate-zhao": { lastActiveAt: ago(25) },
  "candidate-li": { lastActiveAt: ago(15) },
  "candidate-su": { lastActiveAt: ago(70) },
};

export function demoChatActivity(id: string, isEmployer: boolean): Activity | undefined {
  return (isEmployer ? candidates : employers)[id];
}

export function demoEmployerReplyCount(activity: Activity, now: number): number {
  return new Set(
    (activity.replies ?? [])
      .filter((reply) => aucklandDay(Date.parse(reply.sentAt)) === aucklandDay(now))
      .map((reply) => reply.candidateId),
  ).size;
}
