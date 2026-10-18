"use client";

import { useEffect, useState } from "react";
import { payReferenceFor, type PayReferenceAnswer } from "@/app/[lang]/jobs/pay-reference-actions";
import { jobRate } from "@/lib/pay-reference";
import type { CountryCode, Industry } from "@/lib/types";
import { PayReferenceBox } from "@/components/ui/PayReferenceBox";
import { useLang, useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/**
 * 时薪参考 beside the pay an employer is filling in (#85): asked from the server once the industry is known, and again
 * when the industry or region changes. Below the median it says so; it never blocks (the minimum wage is the
 * compliance check's, which stops a job below it).
 */
export function PayReferenceHint({
  country,
  industry,
  regionId,
  pay,
  exclude,
}: {
  country: CountryCode;
  industry?: Industry;
  regionId?: string;
  pay?: { min?: number; max?: number };
  /** A job being edited or republished, left out of its own reference. */
  exclude?: string;
}) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).payReference;
  const [loaded, setLoaded] = useState<{ key: string; answer: PayReferenceAnswer | null }>();
  const key = `${industry ?? ""}|${regionId ?? ""}|${exclude ?? ""}`;

  useEffect(() => {
    if (!industry) return;
    let live = true;
    payReferenceFor(industry, regionId, exclude)
      .then((answer) => live && setLoaded({ key, answer }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [industry, regionId, exclude, key]);

  if (!industry) return <p className="text-meta text-muted">{t.chooseIndustry}</p>;
  const answer = loaded?.key === key ? loaded.answer : undefined;
  if (!answer) return null;
  const rate = pay?.min != null ? jobRate({ min: pay.min, max: pay.max }) : undefined;
  return (
    <PayReferenceBox
      reference={answer.reference}
      at={answer.at}
      country={country}
      industry={industry}
      rate={rate}
      lang={lang}
    />
  );
}
