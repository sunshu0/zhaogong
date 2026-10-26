// 操作手感 T2 (#405): a press shows its change at once, then the server is asked. When the server says no or gives no
// answer, the change is taken back, so what shows is never a change the server does not have once the answer is in.

export type Sent<T> = { ok: true; answer: T } | { ok: false };

/**
 * Runs `show`, then `send`. A rejected `send`, or an answer `accepted` turns down (by default only `false`), runs
 * `undo` and resolves to `{ ok: false }`; the caller says it failed. Never rejects.
 */
export async function showThenSend<T>({
  show,
  undo,
  send,
  accepted = (answer) => answer !== false,
}: {
  show: () => void;
  undo: () => void;
  send: () => Promise<T>;
  accepted?: (answer: T) => boolean;
}): Promise<Sent<T>> {
  show();
  let answer: T;
  try {
    answer = await send();
  } catch {
    undo();
    return { ok: false };
  }
  if (!accepted(answer)) {
    undo();
    return { ok: false };
  }
  return { ok: true, answer };
}
