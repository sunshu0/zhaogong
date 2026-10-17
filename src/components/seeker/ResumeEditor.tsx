"use client";

import { COUNTRIES } from "@/config/countries";
import { JOB_ROLE_IDS, JOB_ROLES } from "@/config/job-roles";
import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import { ChoicePill } from "@/components/employer/ChoicePill";
import { Checkbox } from "@/components/ui/Checkbox";
import { inputClass as sharedInputClass } from "@/components/ui/input-class";
import { EMPTY_RESUME, type Resume } from "@/lib/candidate-matching";
import type { EmploymentType } from "@/lib/types";

const toggle = <T,>(values: T[], value: T) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
const numberOrEmpty = (value: string) => (value === "" ? undefined : Number(value));
// Round 19 (#174): the shared inputs (16px text, so phones do not zoom in) and B's choice pills, so 想做的岗位
// looks like 岗位类别 in the post form. ChoicePill stays in components/employer until it moves to ui.
const inputClass = sharedInputClass();

type ResumeProps = { value?: Resume; onChange: (value: Resume) => void };

/** Applies a change to the resume, giving it an id the first time so it can be recommended. */
function resumeUpdater({ value = EMPTY_RESUME, onChange }: ResumeProps) {
  return (patch: Partial<Resume>) =>
    onChange({ ...value, ...patch, candidateId: value.candidateId ?? crypto.randomUUID() });
}

/** 期望时薪 and 经验: two of the five things employers look at first. */
export function ResumeKeyFields(props: ResumeProps) {
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-body">
        <span className="mb-1 block font-medium">期望时薪（NZ$ / 小时起）</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="200"
          step="0.5"
          value={value.expectedMinPay ?? ""}
          onChange={(event) => update({ expectedMinPay: numberOrEmpty(event.target.value) })}
          placeholder="例如：25"
          className={inputClass}
        />
      </label>
      <label className="block text-body">
        <span className="mb-1 block font-medium">经验（年）</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="60"
          step="0.5"
          value={value.experienceYears ?? ""}
          onChange={(event) => update({ experienceYears: numberOrEmpty(event.target.value) })}
          placeholder="没有经验填 0"
          className={inputClass}
        />
      </label>
    </div>
  );
}

/** 想做的岗位 (#96): the categories recommendations compare with a job's, any number. */
export function ResumeRoleField(props: ResumeProps) {
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  const roles = value.roles ?? [];
  return (
    <fieldset>
      <legend className="mb-1 text-body font-medium">想做的岗位</legend>
      <p className="mb-2 text-meta text-muted">可多选。雇主找人时按岗位类别匹配，前台、服务员、接待都算前厅服务。</p>
      <div className="flex flex-wrap gap-2">
        {JOB_ROLE_IDS.map((id) => (
          <ChoicePill
            key={id}
            type="checkbox"
            checked={roles.includes(id)}
            onChange={() => update({ roles: toggle(roles, id) })}
          >
            {JOB_ROLES[id].zh}
          </ChoicePill>
        ))}
      </div>
    </fieldset>
  );
}

/** The rest of the resume: skills, employment types, weekly hours and the regions you can work in. */
export function ResumeMoreFields(props: ResumeProps) {
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  return (
    <div className="space-y-4">
      <label className="block text-body">
        <span className="mb-1 block font-medium">工作技能（补充说明）</span>
        <input
          value={value.skills}
          onChange={(event) => update({ skills: event.target.value })}
          placeholder="例如：点餐、上菜、收银"
          className={inputClass}
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-body font-medium">期望用工形式</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, { zh: string }][]).map(([type, label]) => (
            <ChoicePill
              key={type}
              type="checkbox"
              checked={value.employmentTypes.includes(type)}
              onChange={() => update({ employmentTypes: toggle(value.employmentTypes, type) })}
            >
              {label.zh}
            </ChoicePill>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-body font-medium">每周可工作工时</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["min", "max"] as const).map((key) => (
            <label key={key} className="text-body">
              <span className="mb-1 block text-muted">{key === "min" ? "最少小时" : "最多小时"}</span>
              <input
                type="number"
                min="1"
                max="80"
                value={value.hoursPerWeek?.[key] ?? ""}
                onChange={(event) => {
                  const next = numberOrEmpty(event.target.value);
                  const other = value.hoursPerWeek?.[key === "min" ? "max" : "min"] ?? next;
                  update({
                    hoursPerWeek:
                      next === undefined || other === undefined
                        ? undefined
                        : key === "min"
                          ? { min: next, max: Math.max(next, other) }
                          : { min: Math.min(next, other), max: next },
                  });
                }}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-body font-medium">可工作地区</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTRIES.NZ.regions.map((region) => (
            <Checkbox
              key={region.id}
              checked={value.regionIds.includes(region.id)}
              onChange={() => update({ regionIds: toggle(value.regionIds, region.id) })}
            >
              {region.nameZh}
            </Checkbox>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Whether employers can find this profile in 推荐人才. */
export function DiscoverableToggle(props: ResumeProps) {
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  return (
    <Checkbox
      className="font-medium"
      checked={value.discoverable}
      onChange={(event) => update({ discoverable: event.target.checked })}
    >
      允许向雇主推荐我的求职主页
    </Checkbox>
  );
}
