"use server";

// 查看记录 for /admin (#336, ADR 0026): whose personal information moderators were shown, by moderator and period.
// A moderator only (requireModerator, as every /admin Server Function). The list itself names moderators only, so
// reading it is not recorded.
import { listViewModerators, listViews, type PersonalInfoView } from "@/db/personal-info-views";
import { refusedText, requireModerator } from "@/app/[lang]/admin/moderator";
import { VIEW_DAYS, type ViewDays } from "@/lib/personal-info-views";
import type { Refused } from "@/app/[lang]/admin/actions";

export interface PersonalInfoViewList {
  days: ViewDays;
  /** The moderator asked for, or "" for everyone. */
  moderator: string;
  views: PersonalInfoView[];
  /** There were more than the list shows (LIST_LIMIT). */
  more: boolean;
  /** Everyone with a record, for the filter. */
  moderators: string[];
}

export async function getPersonalInfoViews(moderator: unknown, days: unknown): Promise<PersonalInfoViewList | Refused> {
  const me = await requireModerator();
  if (!me.ok) return { refused: me.reason, error_zh: await refusedText(me.reason) };
  const period: ViewDays = VIEW_DAYS.find((d) => d === days) ?? VIEW_DAYS[0];
  const moderators = await listViewModerators();
  const who = typeof moderator === "string" && moderators.includes(moderator) ? moderator : "";
  const { views, more } = await listViews({ moderator: who || undefined, days: period });
  return { days: period, moderator: who, views, more, moderators };
}
