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
import { useSwapFocus } from "@/components/ui/use-swap-focus";
import { busyFor } from "@/components/employer/busy-for";
import { APP_SHEET, BACK_LINK, noticeClass } from "@/components/employer/app-style";
import { Button, Spinner } from "@/components/ui/Button";
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
  // Which change is on its way (UI review 3): 删除 under one photo or the upload; only its control says so.
  const [pressed, setPressed] = useState<string>();
  const working = busy ? pressed : undefined;
  const input = useRef<HTMLInputElement>(null);
  // The benefits save themselves on each tick (design-system「资料类表单自动保存」): where the last one stands, and
  // which save is the last, so an answer that comes back late does not undo a newer tick.
  const [benefitsNote, setBenefitsNote] = useState<{ ok: boolean; text: string }>();
  const benefitsTurn = useRef(0);
  const benefitsAnswered = useRef(0);

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
    // A benefits save still on its way has the newer list.
    if (benefitsAnswered.current === benefitsTurn.current) setBenefits(result.snapshot.benefits);
    setMessage({ ok: !result.error, text: result.said });
  };
  const saveBenefits = (next: Benefit[]) => {
    setBenefits(next);
    const turn = ++benefitsTurn.current;
    setBenefitsNote({ ok: true, text: words.benefits.saving });
    const done = (note: { ok: boolean; text: string }, result?: CompanyPhotosResult) => {
      if (turn !== benefitsTurn.current) return;
      benefitsAnswered.current = turn;
      if (result) {
        setState(result.snapshot);
        setBenefits(result.snapshot.benefits);
      }
      setBenefitsNote(note);
    };
    saveCompanyBenefits(next).then(
      (result) => (result ? done({ ok: !result.error, text: result.said }, result) : load()),
      () => done({ ok: false, text: words.benefits.failed }),
    );
  };
  const act = (key: string, run: () => Promise<CompanyPhotosResult | null>) => {
    setPressed(key);
    startTransition(async () => {
      try {
        answered(await run());
      } catch {
        setMessage({ ok: false, text: t.failed });
      }
    });
  };

  const upload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    act("upload", async () => {
      const form = new FormData();
      form.set("photo", await smaller(file), file.name);
      return uploadCompanyPhoto(form);
    });
    if (input.current) input.current.value = "";
  };

  if (state === "failed") return <LoadFailed what={t.heading} onRetry={load} />;
  if (state === undefined) return <SkeletonCard />;
  // The server found no business for this account (not signed in as an employer, or no business yet): say so.
  if (state === null) return <p className="text-body">{t.noBusiness}</p>;
  const shown = state.photos.filter((photo) => photo.status !== "rejected").length;
  const full = shown >= PHOTOS_MAX;
  const uploading = working === "upload";
  const uploadHeld = full || (working !== undefined && !uploading);

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
                    <RemovePhoto
                      n={i + 1}
                      {...busyFor(working, `remove:${photo.id}`)}
                      onRemove={() => act(`remove:${photo.id}`, () => removeCompanyPhoto(photo.id))}
                    />
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
            <label className={`inline-flex ${uploadHeld || uploading ? "pointer-events-none opacity-60" : ""}`}>
              <span className="pressable inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-brand px-4 text-body font-medium text-white">
                {uploading && <Spinner />}
                {uploading ? t.uploading : t.choose}
              </span>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploadHeld || uploading}
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
                saveBenefits(BENEFITS.filter((b) => (b === benefit ? on : benefits.includes(b))));
              }}
            >
              {words.benefits.labels[benefit]}
            </Checkbox>
          ))}
        </div>
        {/* Polite, not a status: the focus stays on the box just ticked, and the page's one status is the photos'. */}
        <p
          aria-live="polite"
          className={`text-meta ${benefitsNote && !benefitsNote.ok ? "text-danger" : "text-muted"}`}
        >
          {benefitsNote?.text}
        </p>
      </section>
    </div>
  );
}

/**
 * 删除 under one photo: a photo once gone has to be taken and sent for review again, so the press asks first —
 * 确认删除 and 取消 take the place of 删除, with the focus (#189, as 移除 on the team page).
 */
function RemovePhoto({
  n,
  loading,
  disabled,
  onRemove,
}: {
  n: number;
  loading: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const t = useMessages(employerPhotosMessages).photos;
  const [confirming, setConfirming] = useState(false);
  const { opener, form } = useSwapFocus<HTMLDivElement, HTMLDivElement>(confirming);
  return confirming ? (
    <div ref={form} className="flex flex-wrap justify-end gap-x-2">
      <Button
        variant="link"
        aria-label={t.confirmRemoveLabel(n)}
        loading={loading}
        disabled={disabled}
        onClick={() => {
          setConfirming(false);
          onRemove();
        }}
      >
        {t.confirmRemove}
      </Button>
      <Button variant="link" onClick={() => setConfirming(false)}>
        {t.cancel}
      </Button>
    </div>
  ) : (
    <div ref={opener}>
      <Button
        variant="link"
        aria-label={t.removeLabel(n)}
        loading={loading}
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {t.remove}
      </Button>
    </div>
  );
}
