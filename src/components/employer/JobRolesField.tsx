"use client";
import { JOB_ROLE_IDS, JOB_ROLES, MAX_JOB_ROLES, type JobRoleId } from "@/config/job-roles";
import { roleFitsIndustry, suggestJobRoles } from "@/lib/job-roles";
import { formRoles, type PostForm } from "@/components/employer/post-form";
import { ChoicePill } from "@/components/employer/ChoicePill";
import { useLang, useMessages } from "@/i18n/client";
import type { Lang } from "@/i18n/lang";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/** The categories as one line in the page's language (lib/job-roles' roleNames is Chinese only). */
export function roleNamesIn(ids: readonly JobRoleId[], lang: Lang, separator: string): string {
  return ids.map((id) => JOB_ROLES[id][lang]).join(separator);
}

/**
 * 岗位类别 (#96, ADR 0013): at most two. Until the employer picks, the categories the title names are ticked; the
 * job's industry decides which categories are offered, and a category already ticked stays in the list.
 */
export function JobRolesField({ form, set }: { form: PostForm; set: (patch: Partial<PostForm>) => void }) {
  const lang = useLang();
  const m = useMessages(employerPostMessages);
  const t = m.roles;
  const chosen = formRoles(form);
  const suggested = suggestJobRoles(form);
  const offered = JOB_ROLE_IDS.filter((id) => chosen.includes(id) || roleFitsIndustry(id, form.industry));
  const full = chosen.length >= MAX_JOB_ROLES;
  const names = (ids: readonly JobRoleId[]) => roleNamesIn(ids, lang, m.checklist.separator);
  const toggle = (id: JobRoleId) =>
    set({ roles: chosen.includes(id) ? chosen.filter((r) => r !== id) : [...chosen, id] });
  return (
    <fieldset id="field-roles" className="space-y-1.5">
      <legend className="mb-1.5 text-body font-medium">{t.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {offered.map((id) => (
          <ChoicePill
            key={id}
            type="checkbox"
            name="roles"
            checked={chosen.includes(id)}
            disabled={full && !chosen.includes(id)}
            onChange={() => toggle(id)}
          >
            {JOB_ROLES[id][lang]}
          </ChoicePill>
        ))}
      </div>
      <p className="text-meta text-muted">
        {form.roles == null && suggested.length
          ? t.preselected(names(suggested))
          : chosen.length
            ? t.max(MAX_JOB_ROLES)
            : suggested.length
              ? t.fallback(names(suggested))
              : t.none}
      </p>
    </fieldset>
  );
}
