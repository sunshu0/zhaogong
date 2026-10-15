"use client";
import type { RefObject } from "react";
import type { CountryCode, Employer } from "@/lib/types";
import { ChatPost } from "@/components/employer/ChatPost";
import { completeJob } from "@/components/employer/post-form";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { usePosting, type Posting as PostingController } from "@/components/employer/post-flow-state";
import { BottomBar, FormBar, PreviewBar } from "@/components/employer/PostFlowBars";
import { FormStep, ModeSwitch, PasteStep, PreviewStep, StepList } from "@/components/employer/PostFlowSteps";
import { Published } from "@/components/employer/Published";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";

/** /employer/post: the employer identity first, then the chat or the form. */
export function PostFlow({ country }: { country: CountryCode }) {
  return <EmployerGate next="/employer/post">{(me) => <Posting me={me} country={country} />}</EmployerGate>;
}

function Posting({ me, country }: { me: EmployerIdentity; country: CountryCode }) {
  const posting = usePosting(me.email, country);
  const heading = useFocusOnChange<HTMLHeadingElement>(posting.step);

  // The badge and a ban come from the server; the session only has the name.
  const { profile } = useEmployerProfile(me.email);
  const view: PostingView = {
    posting,
    country,
    heading,
    employer: profile ?? undefined,
    shopName: profile?.name ?? me.employerName,
    banned: !!profile?.bannedAt,
    needsReview: posting.form.decision.status === "pending_review",
    employerId: me.employerId,
    email: me.email,
  };

  if (posting.step === "done" && posting.published) {
    return (
      <Published job={posting.published} employer={view.employer} headingRef={heading} onAgain={posting.startOver} />
    );
  }
  const choosingMode = posting.step === "chat" || posting.step === "paste";

  return (
    <div className="space-y-4 pb-24">
      <StepList mode={posting.mode} step={posting.step} />
      {choosingMode && <ModeSwitch mode={posting.mode} onSwitch={posting.switchMode} />}
      {posting.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{posting.error}</p>}
      <CurrentStep view={view} />
      <StepBar view={view} />
    </div>
  );
}

/** What Posting hands its parts: the posting state plus what the page knows about the employer. */
type PostingView = {
  posting: PostingController;
  country: CountryCode;
  heading: RefObject<HTMLHeadingElement | null>;
  employer?: Employer;
  email: string;
  shopName: string;
  banned: boolean;
  needsReview: boolean;
  employerId: string;
};

/** The body of the current step: the chat, the paste box, the form or the preview. */
function CurrentStep({ view }: { view: PostingView }) {
  const { posting, country, heading } = view;
  switch (posting.step) {
    case "chat":
      return (
        <ChatPost
          chat={posting.chat}
          setChat={posting.setChat}
          country={country}
          headingRef={heading}
          onPreview={posting.previewFromChat}
          onUseForm={posting.switchToForm}
        />
      );
    case "paste":
      return (
        <PasteStep
          headingRef={heading}
          text={posting.text}
          setText={posting.setText}
          pending={posting.pending}
          onParse={posting.parse}
          onEmptyForm={posting.startEmptyForm}
        />
      );
    case "form":
      return <FormStep headingRef={heading} form={posting.form} country={country} notes={posting.notes} />;
    case "preview":
      return <Preview view={view} />;
    default:
      return null;
  }
}

function Preview({ view }: { view: PostingView }) {
  const { posting, heading } = view;
  const preview = completeJob(posting.form.draft, view.employerId, posting.previewAt, posting.form.decision.status);
  if (!preview) return null;
  return (
    <PreviewStep
      headingRef={heading}
      preview={{ ...preview, id: "preview" }}
      employer={view.employer}
      previewAt={posting.previewAt}
      needsReview={view.needsReview}
      banned={view.banned}
    />
  );
}

/** The sticky bar under the form (上一步 · 预览) or the preview (返回修改 · 发布). */
function StepBar({ view }: { view: PostingView }) {
  const { posting } = view;
  if (posting.step === "form") {
    return (
      <BottomBar wide>
        <FormBar form={posting.form} onBack={() => posting.setStep("paste")} onPreview={posting.toPreview} />
      </BottomBar>
    );
  }
  if (posting.step !== "preview") return null;
  return (
    <BottomBar wide={false}>
      <PreviewBar
        shopName={view.shopName}
        disabled={view.banned || posting.pending}
        pending={posting.pending}
        needsReview={view.needsReview}
        onBack={posting.backFromPreview}
        onPublish={posting.publish}
      />
    </BottomBar>
  );
}
