// The shop benefits on /employer/photos save themselves on each tick (design-system「资料类表单自动保存」, UI review 3).
// The list lives here, not in a render's closure, so two ticks in one frame both count (rework 1 #3); each save has a
// turn, so an answer that comes back late neither undoes a newer tick nor reports for it. Only the benefits come from
// a save's answer: its photos are older than an upload made meanwhile (rework 1 #2). So a save's answer no longer
// sets the page's state: a change it carries, such as `canEdit` after the account stopped being a team admin, shows
// only when the page next reads itself (load, an upload's answer). A save that fails puts the boxes back to the list
// the server last said it had (rework 2 #8). Its 没有保存成功 stays until the next save says otherwise or the page reads
// itself again (a snapshot asked for after that save clears the line, rework 3 #1, #2, rework 4 #1); a save with no answer at all (the network) does
// not make the page read itself, which could only fail the same way and swap the page for 加载失败.
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
  /** Undefined: nothing to say (a snapshot read afresh was taken). */
  onNote: (note: BenefitsNote | undefined) => void;
}) {
  let list: Benefit[] = [];
  let turn = 0;
  let answered = 0;
  // The list the server last said it had, and the turn that said it (0: a snapshot read afresh).
  let confirmed: Benefit[] = [];
  let confirmedTurn = 0;
  // The turn whose save last set the line under the boxes; a snapshot asked for before it says nothing about it.
  let noteTurn = 0;
  /** A failed save: the boxes go back to what the server has. */
  const rollBack = () => {
    list = confirmed;
    onList(list);
  };
  return {
    /** Where the saves stand now: taken when a snapshot is asked for (load, an upload, a removal), for `reset`. */
    stamp(): number {
      return turn;
    },
    /**
     * A snapshot read afresh, asked for at `askedAt` (`stamp`): taken unless a save is still on its way with a newer
     * list. Taken, it clears the line under the boxes (rework 3 #1) only when it was asked for after the save that set
     * the line: an upload sent before a tick that then failed keeps 没有保存成功 (rework 4 #1).
     */
    reset(next: Benefit[], askedAt: number) {
      if (answered !== turn) return;
      list = confirmed = next;
      confirmedTurn = turn;
      onList(list);
      if (askedAt >= noteTurn) onNote(undefined);
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
      noteTurn = mine;
      const settle = (then: () => "gone" | undefined) => {
        if (mine !== turn) return undefined;
        answered = mine;
        return then();
      };
      return save(list).then(
        (result) => {
          // An answer dropped for a newer tick still says what the server had then.
          if (result && mine > confirmedTurn) {
            confirmed = result.snapshot.benefits;
            confirmedTurn = mine;
          }
          return settle(() => {
            if (!result) {
              // Not left on 正在保存…: say it did not save, put the boxes back, then read the page again (rework 1 #1).
              onNote({ kind: "failed" });
              rollBack();
              return "gone";
            }
            list = result.snapshot.benefits;
            onList(list);
            onNote({ kind: "said", ok: !result.error, text: result.said });
            return undefined;
          });
        },
        () =>
          settle(() => {
            // No answer (the network): 没有保存成功 stays until the next save or read (see the top of this file).
            onNote({ kind: "failed" });
            rollBack();
            return undefined;
          }),
      );
    },
  };
}
