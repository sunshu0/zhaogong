"use client";

// 常用语 (#372): a row above the chat's box, one press sends; 管理 changes them, and the job seeker's 开场白 (#373).
// ADR 0035. Each identity has its own list; until a person changes it, the defaults in the page's language.
import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { saveChatPhrases, useChatPhrases } from "@/components/seeker/chat-phrases-client";
import { ChatDialog, CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { useSession } from "@/components/seeker/session-client";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/input-class";
import { toast } from "@/components/ui/Toast";
import { useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { chatMessages } from "@/i18n/messages/chat";
import {
  OPENER_MAX,
  PHRASE_MAX,
  PHRASES_MAX,
  shownPhrases,
  type ChatPhrases,
  type OpenerChoice,
  type PhraseRole,
  type PhrasesProblem,
} from "@/lib/chat-phrases";

/**
 * The row of 常用语 and 管理. Empty until the account's own have loaded, so a press never sends the wrong list; its
 * room is kept meanwhile, so the box does not jump when they come.
 */
export function ChatPhraseRow({ role, onPick }: { role: PhraseRole; onPick: (phrase: string) => void }) {
  const t = useMessages(chatMessages).phrases;
  const kept = useChatPhrases(useSession()?.email);
  const [managing, setManaging] = useState(false);
  if (!kept) return <div aria-hidden="true" className="mb-2 min-h-12" />;
  const phrases = shownPhrases(kept, role, role === "seeker" ? t.seekerDefaults : t.employerDefaults);
  return (
    <div className="mb-2 flex items-center gap-2">
      <ul aria-label={t.rowLabel} className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        {phrases.map((phrase, index) => (
          <li key={`${index}:${phrase}`} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(phrase)}
              aria-label={t.sendPhrase(phrase)}
              title={phrase}
              className="pressable inline-flex min-h-11 max-w-[16rem] items-center rounded-full border border-border bg-background px-3.5 py-2 text-meta hover:border-brand"
            >
              <span lang={contentLang(phrase)} className="truncate">
                {phrase}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setManaging(true)}
        aria-label={t.manageLabel}
        title={t.manageLabel}
        className="pressable inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-meta text-brand hover:bg-brand-soft"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {t.manage}
      </button>
      {managing && <PhrasesDialog role={role} kept={kept} onClose={() => setManaging(false)} />}
    </div>
  );
}

type Row = { id: number; text: string };
/** Keys for the dialog's rows, so a row keeps its input (and focus) while the list moves. */
let rowId = 0;
const rows = (texts: readonly string[]): Row[] => texts.map((text) => ({ id: rowId++, text }));
type OpenerPick = "1" | "2" | "3" | "own";

const pickOf = (opener: OpenerChoice | null): OpenerPick =>
  opener && "text" in opener ? "own" : (String(opener?.template ?? 1) as OpenerPick);

/** 管理: the identity's 常用语 (add, change, delete, move, restore the defaults) and, for a job seeker, the 开场白. */
function PhrasesDialog({ role, kept, onClose }: { role: PhraseRole; kept: ChatPhrases; onClose: () => void }) {
  const t = useMessages(chatMessages).phrases;
  const defaults = role === "seeker" ? t.seekerDefaults : t.employerDefaults;
  const [list, setList] = useState<Row[]>(() => rows(shownPhrases(kept, role, defaults)));
  // What the save sends for the list: nothing while untouched, null after 恢复默认, else the list.
  const [listState, setListState] = useState<"untouched" | "restored" | "changed">("untouched");
  const [pick, setPick] = useState<OpenerPick>(() => pickOf(kept.opener));
  const [own, setOwn] = useState(() => (kept.opener && "text" in kept.opener ? kept.opener.text : ""));
  const [openerChanged, setOpenerChanged] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const openerId = useId();

  function change(next: Row[]) {
    setList(next);
    setListState("changed");
    setError("");
  }
  function move(index: number, by: -1 | 1) {
    const next = [...list];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    change(next);
    // The focus stays with the button pressed, which is now on the row the phrase moved to.
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelectorAll<HTMLButtonElement>(by < 0 ? "[data-move-up]" : "[data-move-down]")
        [index + by]?.focus(),
    );
  }
  function add() {
    const row = { id: rowId++, text: "" };
    change([...list, row]);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLInputElement>(`#phrase-${row.id}`)?.focus());
  }

  function problemText(why: PhrasesProblem): string {
    const found = (words: string[]) => words.join(t.foundJoiner);
    switch (why.problem) {
      case "too_many":
        return t.tooMany(PHRASES_MAX);
      case "too_long":
        return why.index === undefined ? t.openerTooLong(OPENER_MAX) : t.tooLong(why.index + 1, PHRASE_MAX);
      case "empty":
        return t.openerEmpty;
      case "contact":
        return why.index === undefined ? t.openerContact(found(why.found)) : t.contact(why.index + 1, found(why.found));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pick === "own" && !own.trim()) return setError(t.openerEmpty);
    setSaving(true);
    const answer = await saveChatPhrases({
      role,
      ...(listState === "restored" && { phrases: null }),
      ...(listState === "changed" && { phrases: list.map((row) => row.text) }),
      ...(role === "seeker" &&
        openerChanged && { opener: pick === "own" ? { text: own } : { template: Number(pick) } }),
    }).catch(() => null);
    setSaving(false);
    if (!answer) return setError(t.notSaved);
    if (!answer.ok) return setError(problemText(answer.why));
    toast(t.saved);
    onClose();
  }

  return (
    <ChatDialog title={t.dialogTitle} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <section className="space-y-3" aria-labelledby={`${openerId}-list`}>
          <h3 id={`${openerId}-list`} className="text-body font-semibold">
            {t.listHeading}
          </h3>
          <p className="text-meta text-muted">{t.listNote(PHRASES_MAX, PHRASE_MAX)}</p>
          <ol ref={listRef} className="space-y-2">
            {list.map((row, index) => (
              <li key={row.id} className="flex items-center gap-1">
                <input
                  id={`phrase-${row.id}`}
                  value={row.text}
                  maxLength={PHRASE_MAX}
                  aria-label={t.phraseLabel(index + 1)}
                  lang={contentLang(row.text)}
                  onChange={(e) => change(list.map((r) => (r.id === row.id ? { ...r, text: e.target.value } : r)))}
                  className={`${inputClass()} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  data-move-up=""
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t.moveUp(index + 1)}
                  title={t.moveUp(index + 1)}
                  className="pressable flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background disabled:opacity-40"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  data-move-down=""
                  disabled={index === list.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t.moveDown(index + 1)}
                  title={t.moveDown(index + 1)}
                  className="pressable flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background disabled:opacity-40"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => change(list.filter((r) => r.id !== row.id))}
                  aria-label={t.remove(index + 1)}
                  title={t.remove(index + 1)}
                  className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={add} disabled={list.length >= PHRASES_MAX} className={CHAT_COMMAND_CLASS}>
              <Plus aria-hidden="true" className="size-4" />
              {t.add}
            </button>
            <button
              type="button"
              onClick={() => {
                setList(rows(defaults));
                setListState("restored");
                setError("");
              }}
              className={CHAT_COMMAND_CLASS}
            >
              {t.restore}
            </button>
          </div>
        </section>

        {role === "seeker" && (
          <fieldset className="space-y-2">
            <legend className="text-body font-semibold">{t.openerHeading}</legend>
            <p className="text-meta text-muted">{t.openerNote}</p>
            {t.openers.map((template, index) => (
              <label key={template} className="flex min-h-11 cursor-pointer items-start gap-2 py-1">
                <input
                  type="radio"
                  name="opener"
                  value={String(index + 1)}
                  checked={pick === String(index + 1)}
                  onChange={() => {
                    setPick(String(index + 1) as OpenerPick);
                    setOpenerChanged(true);
                    setError("");
                  }}
                  className="mt-1 size-5 shrink-0 accent-brand"
                />
                <span className="text-body">
                  <span className="sr-only">{t.openerTemplate(index + 1)}</span>
                  {template}
                </span>
              </label>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="opener"
                value="own"
                checked={pick === "own"}
                onChange={() => {
                  setPick("own");
                  setOpenerChanged(true);
                  setError("");
                }}
                className="size-5 shrink-0 accent-brand"
              />
              <span className="text-body">{t.openerOwn}</span>
            </label>
            {pick === "own" && (
              <textarea
                value={own}
                maxLength={OPENER_MAX}
                rows={3}
                aria-label={t.openerOwnLabel}
                lang={contentLang(own)}
                onChange={(e) => {
                  setOwn(e.target.value);
                  setOpenerChanged(true);
                  setError("");
                }}
                className={inputClass({ multiline: true })}
              />
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}
        <Button type="submit" loading={saving} disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </form>
    </ChatDialog>
  );
}
