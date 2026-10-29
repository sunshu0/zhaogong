"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  myCompanyPhotos,
  removeCompanyPhoto,
  saveCompanyBenefits,
  uploadCompanyPhoto,
  type CompanyPhotosResult,
  type CompanyPhotosSnapshot,
} from "@/app/[lang]/employer/photo-actions";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { APP_SHEET, BACK_LINK, noticeClass } from "@/components/employer/app-style";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { BENEFITS, PHOTO_EDGE_MAX, PHOTOS_MAX, type Benefit } from "@/lib/company-photos";
import { useMessages } from "@/i18n/client";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import Link from "next/link";

/**
 * The photo as the browser sends it: the longer side at most PHOTO_EDGE_MAX pixels, drawn again (which leaves the
 * camera's metadata behind; the server removes it anyway). What the browser cannot draw goes as it is, for the server
 * to judge by its bytes.
 */
async function smaller(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_EDGE_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.85));
    return blob && blob.type === "image/webp"
      ? blob
      : await new Promise<Blob>((done, fail) =>
          canvas.toBlob((jpeg) => (jpeg ? done(jpeg) : fail(new Error("no jpeg"))), "image/jpeg", 0.85),
        );
  } catch {
    return file;
  }
}

/** 门店照片和福利 (ADR 0052): the business's shop photos and benefits; a team admin changes them, a member reads. */
export function CompanyPhotos() {
  return <EmployerGate next="/employer/photos">{(me) => <Photos me={me} />}</EmployerGate>;
}

function Photos({ me }: { me: EmployerIdentity }) {
  const words = useMessages(employerPhotosMessages);
  const t = words.photos;
  const [state, setState] = useState<CompanyPhotosSnapshot | null | "failed">();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const messageRef = useFocusOnChange<HTMLParagraphElement>(message);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [busy, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  /** Asks for the snapshot; `live` says whether its answer is still wanted. */
  const fetchSnapshot = useCallback((live: () => boolean) => {
    myCompanyPhotos().then(
      (snapshot) => {
        if (!live()) return;
        setState(snapshot);
        if (snapshot) setBenefits(snapshot.benefits);
      },
      () => live() && setState("failed"),
    );
  }, []);
  // Loaded again for another identity; an answer for the one before is dropped.
  useEffect(() => {
    let live = true;
    fetchSnapshot(() => live);
    return () => {
      live = false;
    };
  }, [fetchSnapshot, me.email]);
  const load = useCallback(() => {
    setState(undefined);
    fetchSnapshot(() => true);
  }, [fetchSnapshot]);

  const answered = (result: CompanyPhotosResult | null) => {
    if (!result) return load();
    setState(result.snapshot);
    setBenefits(result.snapshot.benefits);
    setMessage({ ok: !result.error, text: result.said });
  };
  const act = (run: () => Promise<CompanyPhotosResult | null>) =>
    startTransition(async () => {
      try {
        answered(await run());
      } catch {
        setMessage({ ok: false, text: t.failed });
      }
    });

  const upload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    act(async () => {
      const form = new FormData();
      form.set("photo", await smaller(file), file.name);
      return uploadCompanyPhoto(form);
    });
    if (input.current) input.current.value = "";
  };

  if (state === "failed") return <LoadFailed what={t.heading} onRetry={load} />;
  if (state === undefined) return <SkeletonCard />;
  if (state === null) return null;
  const shown = state.photos.filter((photo) => photo.status !== "rejected").length;
  const full = shown >= PHOTOS_MAX;

  return (
    <div className="space-y-5">
      <Link href={`/employers/${state.employerId}`} className={BACK_LINK}>
        {words.page.viewPage}
      </Link>
      <header className="space-y-1">
        <h1 className="text-title font-semibold">{words.page.title}</h1>
        <p className="text-body text-muted">{words.page.description}</p>
      </header>

      {message && (
        <p ref={messageRef} tabIndex={-1} role="status" className={noticeClass(message.ok)}>
          {message.text}
        </p>
      )}
      {!state.canEdit && <p className={noticeClass(false)}>{state.banned ?? t.notAdmin}</p>}

      <section aria-labelledby="company-photos-title" className={`${APP_SHEET} space-y-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="company-photos-title" className="text-subtitle font-semibold">
            {t.heading}
          </h2>
          <span className="text-meta text-muted">{t.count(shown, PHOTOS_MAX)}</span>
        </div>
        <p className="text-meta text-muted">{t.intro}</p>
        {state.photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {state.photos.map((photo, i) => (
              <li key={photo.id} className="space-y-1.5">
                {photo.status === "rejected" ? (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-danger-soft p-2 text-center text-meta text-danger">
                    {t.rejected(words.rejectReasons[photo.reason ?? "unclear"])}
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- served by our own route, already small
                  <img
                    src={`/api/company-photos/${photo.id}`}
                    alt={t.photoAlt(i + 1)}
                    className="aspect-[4/3] w-full rounded-md bg-neutral-soft object-cover"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-meta ${photo.status === "approved" ? "text-brand" : "text-muted"}`}>
                    {photo.status === "approved" ? t.approved : photo.status === "pending" ? t.pending : ""}
                  </span>
                  {state.canEdit && (
                    <Button
                      variant="link"
                      aria-label={t.removeLabel(i + 1)}
                      loading={busy}
                      onClick={() => act(() => removeCompanyPhoto(photo.id))}
                    >
                      {t.remove}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted">{t.empty}</p>
        )}
        {state.canEdit && (
          <div className="space-y-1">
            <label className={`inline-flex ${full || busy ? "pointer-events-none opacity-60" : ""}`}>
              <span className="pressable inline-flex min-h-11 cursor-pointer items-center rounded-control bg-brand px-4 text-body font-medium text-white">
                {busy ? t.uploading : t.choose}
              </span>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={full || busy}
                onChange={(event) => upload(event.currentTarget.files)}
              />
            </label>
            {full && <p className="text-meta text-muted">{t.full}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="company-benefits-title" className={`${APP_SHEET} space-y-3`}>
        <h2 id="company-benefits-title" className="text-subtitle font-semibold">
          {words.benefits.heading}
        </h2>
        <p className="text-meta text-muted">{words.benefits.hint}</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <Checkbox
              key={benefit}
              checked={benefits.includes(benefit)}
              disabled={!state.canEdit}
              onChange={(event) => {
                const on = event.currentTarget.checked;
                setBenefits((now) => BENEFITS.filter((b) => (b === benefit ? on : now.includes(b))));
              }}
            >
              {words.benefits.labels[benefit]}
            </Checkbox>
          ))}
        </div>
        {state.canEdit && (
          <Button variant="secondary" loading={busy} onClick={() => act(() => saveCompanyBenefits(benefits))}>
            {words.benefits.save}
          </Button>
        )}
      </section>
    </div>
  );
}
