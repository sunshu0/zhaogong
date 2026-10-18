"use client";

import { COUNTRIES } from "@/config/countries";
import { JOB_ROLE_IDS, JOB_ROLES } from "@/config/job-roles";
import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import { ChoicePill } from "@/components/employer/ChoicePill";
import { Checkbox } from "@/components/ui/Checkbox";
import { inputClass as sharedInputClass } from "@/components/ui/input-class";
import { EMPTY_RESUME, type Resume } from "@/lib/candidate-matching";
import type { EmploymentType } from "@/lib/types";
import { useLang, useMessages } from "@/i18n/client";
import { seekerProfileMessages } from "@/i18n/messages/seeker-profile";

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
  const r = useMessages(seekerProfileMessages).resumeEditor;
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-body">
        <span className="mb-1 block font-medium">{r.expectedPay}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="200"
          step="0.5"
          value={value.expectedMinPay ?? ""}
          onChange={(event) => update({ expectedMinPay: numberOrEmpty(event.target.value) })}
          placeholder={r.expectedPayPlaceholder}
          className={inputClass}
        />
      </label>
      <label className="block text-body">
        <span className="mb-1 block font-medium">{r.experience}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="60"
          step="0.5"
          value={value.experienceYears ?? ""}
          onChange={(event) => update({ experienceYears: numberOrEmpty(event.target.value) })}
          placeholder={r.experiencePlaceholder}
          className={inputClass}
        />
      </label>
    </div>
  );
}

/** 想做的岗位 (#96): the categories recommendations compare with a job's, any number. */
export function ResumeRoleField(props: ResumeProps) {
  const r = useMessages(seekerProfileMessages).resumeEditor;
  const lang = useLang();
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  const roles = value.roles ?? [];
  return (
    <fieldset>
      <legend className="mb-1 text-body font-medium">{r.roles}</legend>
      <p className="mb-2 text-meta text-muted">{r.rolesHint}</p>
      <div className="flex flex-wrap gap-2">
        {JOB_ROLE_IDS.map((id) => (
          <ChoicePill
            key={id}
            type="checkbox"
            checked={roles.includes(id)}
            onChange={() => update({ roles: toggle(roles, id) })}
          >
            {JOB_ROLES[id][lang]}
          </ChoicePill>
        ))}
      </div>
    </fieldset>
  );
}

/** The rest of the resume: skills, employment types, weekly hours and the regions you can work in. */
export function ResumeMoreFields(props: ResumeProps) {
  const r = useMessages(seekerProfileMessages).resumeEditor;
  const lang = useLang();
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  return (
    <div className="space-y-4">
      <label className="block text-body">
        <span className="mb-1 block font-medium">{r.skills}</span>
        <input
          value={value.skills}
          onChange={(event) => update({ skills: event.target.value })}
          placeholder={r.skillsPlaceholder}
          className={inputClass}
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-body font-medium">{r.employmentTypes}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, { zh: string; en: string }][]).map(
            ([type, label]) => (
              <ChoicePill
                key={type}
                type="checkbox"
                checked={value.employmentTypes.includes(type)}
                onChange={() => update({ employmentTypes: toggle(value.employmentTypes, type) })}
              >
                {label[lang]}
              </ChoicePill>
            ),
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-body font-medium">{r.hours}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["min", "max"] as const).map((key) => (
            <label key={key} className="text-body">
              <span className="mb-1 block text-muted">{key === "min" ? r.minHours : r.maxHours}</span>
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
        <legend className="mb-2 text-body font-medium">{r.regions}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTRIES.NZ.regions.map((region) => (
            <Checkbox
              key={region.id}
              checked={value.regionIds.includes(region.id)}
              onChange={() => update({ regionIds: toggle(value.regionIds, region.id) })}
            >
              {lang === "en" ? region.nameEn : region.nameZh}
            </Checkbox>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Whether employers can find this profile in 推荐人才. */
export function DiscoverableToggle(props: ResumeProps) {
  const r = useMessages(seekerProfileMessages).resumeEditor;
  const value = props.value ?? EMPTY_RESUME;
  const update = resumeUpdater(props);
  return (
    <Checkbox
      className="font-medium"
      checked={value.discoverable}
      onChange={(event) => update({ discoverable: event.target.checked })}
    >
      {r.discoverable}
    </Checkbox>
  );
}
