"use client";

import Link from "next/link";
import { useState } from "react";
import { FileUser } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { useProfile } from "@/components/seeker/hub-client";
import { contactKeys, parseResumeDoc, resumeDocFrom } from "@/components/seeker/resume-doc";
import { ChatDialog, CHAT_COMMAND_CLASS } from "@/components/seeker/ChatDialog";
import { useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";

/**
 * 发送我的简历 behind ＋ (#379, ADR 0037): the job seeker sends their 中英文简历 to the business as a card. The dialog says
 * which contact details go with it, as ticked on the résumé page (去改 goes there); the platform adds and removes
 * none. Without a résumé yet (no name), it points to making one and sends nothing.
 */
export function SendResume({ conversationId }: { conversationId: string }) {
  const t = useMessages(chatMessages).resumeSend;
  const [open, setOpen] = useState(false);
  const { profile } = useProfile();
  const { sendResume } = useChat();
  // What the server keeps (checked the same way), so the dialog says exactly what goes.
  const resume = parseResumeDoc(resumeDocFrom(profile), { withEmail: true });
  const carried = resume ? contactKeys(resume.contact) : [];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={CHAT_COMMAND_CLASS}>
        <FileUser aria-hidden="true" className="size-4" />
        {t.tool}
      </button>
      {open && (
        <ChatDialog title={t.title} onClose={() => setOpen(false)}>
          {resume ? (
            <>
              <p className="text-sm leading-relaxed">{t.note}</p>
              <p className="flex flex-wrap items-center gap-x-3 border-y border-border py-4 text-sm font-medium">
                <span data-resume-carries="">
                  {carried.length
                    ? t.carries(carried.map((key) => t.contactNames[key]).join(t.listJoin))
                    : t.carriesNone}
                </span>
                <Link
                  href="/profile/resume#resume-contact"
                  className="inline-flex min-h-11 items-center font-normal text-brand underline"
                >
                  {t.change}
                </Link>
              </p>
              <p className="text-xs leading-relaxed text-muted">{t.keepNote}</p>
            </>
          ) : (
            <p className="space-x-2 text-sm leading-relaxed">
              <span>{t.noResume}</span>
              <Link href="/profile/resume" className="inline-flex min-h-11 items-center text-brand underline">
                {t.makeResume}
              </Link>
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={CHAT_COMMAND_CLASS} onClick={() => setOpen(false)}>
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={!resume}
              onClick={() => {
                if (!resume) return;
                sendResume(conversationId, resume);
                setOpen(false);
              }}
              className="min-h-11 rounded-md bg-brand px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {t.send}
            </button>
          </div>
        </ChatDialog>
      )}
    </>
  );
}
