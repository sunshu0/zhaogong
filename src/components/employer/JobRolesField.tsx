"use client";
import { JOB_ROLE_IDS, JOB_ROLES, MAX_JOB_ROLES } from "@/config/job-roles";
import { roleFitsIndustry, roleNames, suggestJobRoles } from "@/lib/job-roles";
import { formRoles, type PostForm } from "@/components/employer/post-form";

/**
 * 岗位类别 (#96, ADR 0013): at most two. Until the employer picks, the categories the title names are ticked; the
 * job's industry decides which categories are offered, and a category already ticked stays in the list.
 */
export function JobRolesField({ form, set }: { form: PostForm; set: (patch: Partial<PostForm>) => void }) {
  const chosen = formRoles(form);
  const suggested = suggestJobRoles(form);
  const offered = JOB_ROLE_IDS.filter((id) => chosen.includes(id) || roleFitsIndustry(id, form.industry));
  const full = chosen.length >= MAX_JOB_ROLES;
  const toggle = (id: (typeof JOB_ROLE_IDS)[number]) =>
    set({ roles: chosen.includes(id) ? chosen.filter((r) => r !== id) : [...chosen, id] });
  return (
    <fieldset id="field-roles" className="scroll-mt-20 space-y-1.5">
      <legend className="mb-1.5 text-body font-medium">岗位类别</legend>
      <div className="flex flex-wrap gap-2">
        {offered.map((id) => (
          <label
            key={id}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-body has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand has-disabled:cursor-default has-disabled:opacity-50"
          >
            <input
              type="checkbox"
              name="roles"
              checked={chosen.includes(id)}
              disabled={full && !chosen.includes(id)}
              onChange={() => toggle(id)}
              className="accent-brand"
            />
            {JOB_ROLES[id].zh}
          </label>
        ))}
      </div>
      <p className="text-meta text-muted">
        {form.roles == null && suggested.length
          ? `按职位名预选了${roleNames(suggested)}，可以改。`
          : chosen.length
            ? `最多选 ${MAX_JOB_ROLES} 个。推荐人才按岗位类别找人。`
            : suggested.length
              ? `不选的话按职位名归到${roleNames(suggested)}。`
              : "还没选。不选的话职位显示「岗位类别待选」，推荐人才时这一项不算分。"}
      </p>
    </fieldset>
  );
}
