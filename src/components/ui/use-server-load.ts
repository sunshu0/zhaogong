"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { shownLoad, type Got, type Shown } from "@/components/ui/server-load";

/**
 * A Server Function load for a page (#246): asked when `key` changes (undefined: not yet, no account) and on
 * `reload`. `value` is undefined while the first answer is on its way; `failed` when no answer came (shown with
 * LoadFailed and 重试, which is `reload`). `load` may be a new function every render; the one of the render that
 * asked is used.
 */
export function useServerLoad<T>(key: string | undefined, load: () => Promise<T>): Shown<T> & { reload: () => void } {
  const [got, setGot] = useState<Got<T>>();
  const [version, setVersion] = useState(0);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    if (key === undefined) return;
    let live = true;
    latest.current().then(
      (value) => {
        if (live) setGot({ key, version, value });
      },
      () => {
        if (live) setGot({ key, version, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...shownLoad(got, key, version), reload };
}
