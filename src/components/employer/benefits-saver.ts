// The shop benefits on /employer/photos save themselves on each tick (design-system「资料类表单自动保存」, UI review 3).
// The list lives here, not in a render's closure, so two ticks in one frame both count (rework 1 #3); each save has a
// turn, so an answer that comes back late neither undoes a newer tick nor reports for it. Only the benefits come from
// a save's answer: its photos are older than an upload made meanwhile (rework 1 #2).
import type { CompanyPhotosResult } from "@/app/[lang]/employer/photo-actions";
import { BENEFITS, type Benefit } from "@/lib/company-photos";

/** What the line under the boxes says: on its way, the server's answer, or no answer. */
export type BenefitsNote = { kind: "saving" } | { kind: "said"; ok: boolean; text: string } | { kind: "failed" };

export function createBenefitsSaver({
  save,
  onList,
  onNote,
}: {
  save: (list: Benefit[]) => Promise<CompanyPhotosResult | null>;
  /** The boxes to show ticked. */
  onList: (list: Benefit[]) => void;
  onNote: (note: BenefitsNote) => void;
}) {
  let list: Benefit[] = [];
  let turn = 0;
  let answered = 0;
  return {
    /** A snapshot read afresh (load, an upload's answer): taken unless a save is still on its way with a newer list. */
    reset(next: Benefit[]) {
      if (answered !== turn) return;
      list = next;
      onList(list);
    },
    /**
     * Ticks or unticks one box and saves. Settles on "gone" when the server found no business to save for (signed
     * out, no longer an employer), for the page to read itself again.
     */
    toggle(benefit: Benefit, on: boolean): Promise<"gone" | undefined> {
      list = BENEFITS.filter((b) => (b === benefit ? on : list.includes(b)));
      const mine = ++turn;
      onList(list);
      onNote({ kind: "saving" });
      const settle = (then: () => "gone" | undefined) => {
        if (mine !== turn) return undefined;
        answered = mine;
        return then();
      };
      return save(list).then(
        (result) =>
          settle(() => {
            if (!result) {
              // Not left on 正在保存…: say it did not save, then read the page again (rework 1 #1).
              onNote({ kind: "failed" });
              return "gone";
            }
            list = result.snapshot.benefits;
            onList(list);
            onNote({ kind: "said", ok: !result.error, text: result.said });
            return undefined;
          }),
        () =>
          settle(() => {
            onNote({ kind: "failed" });
            return undefined;
          }),
      );
    },
  };
}
