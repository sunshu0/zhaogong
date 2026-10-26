"use client";
import { useId, useState } from "react";
import { useMessages } from "@/i18n/client";
import { adminMessages } from "@/i18n/messages/admin";
import { banJobEmployer, tempBanJobEmployer, type AdminResult } from "@/app/[lang]/admin/actions";
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Checkbox";
import { inputClass } from "@/components/ui/input-class";
import { BAN_REASON_MAX, TEMP_BAN_DAYS, type TempBanDays } from "@/lib/employer-ban";

/**
 * 封禁雇主 on a reported job (ADR 0044): for 3, 7 or 30 days with a reason the business's team will see, or for good
 * (all their jobs come down, as before). Nothing is chosen at first, so one press never bans by accident.
 */
export function BanChoice({
  jobId,
  employerName,
  run,
  busy,
  disabled,
  onCancel,
}: {
  jobId: string;
  employerName: string;
  run: (key: string, action: () => Promise<AdminResult>) => void;
  busy: boolean;
  disabled: boolean;
  onCancel: () => void;
}) {
  const t = useMessages(adminMessages).queue;
  const id = useId();
  const [length, setLength] = useState<TempBanDays | "permanent">();
  const [reason, setReason] = useState("");
  const temporary = length !== undefined && length !== "permanent";
  const ready = length === "permanent" || (temporary && reason.trim().length > 0);
  return (
    <fieldset className="w-full space-y-2 rounded-control border border-danger/40 p-3">
      <legend className="px-1 text-body font-medium">{t.banLegend(employerName)}</legend>
      <div className="grid gap-x-4 px-2 sm:grid-cols-2">
        {TEMP_BAN_DAYS.map((days) => (
          <Radio key={days} name={`${id}-length`} checked={length === days} onChange={() => setLength(days)}>
            {t.banTemp(days)}
          </Radio>
        ))}
        <Radio name={`${id}-length`} checked={length === "permanent"} onChange={() => setLength("permanent")}>
          {t.banPermanent}
        </Radio>
      </div>
      {temporary && (
        <>
          <label htmlFor={`${id}-reason`} className="block text-body">
            {t.banReason(BAN_REASON_MAX)}
          </label>
          <textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={BAN_REASON_MAX}
            rows={2}
            className={inputClass({ multiline: true })}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={!ready || disabled}
          loading={busy}
          onClick={() =>
            run("ban", () =>
              length === "permanent" ? banJobEmployer(jobId) : tempBanJobEmployer(jobId, length, reason),
            )
          }
        >
          {temporary ? t.confirmTempBan(employerName, length) : t.confirmBan(employerName)}
        </Button>
        <Cancel onClick={onCancel} />
      </div>
    </fieldset>
  );
}
