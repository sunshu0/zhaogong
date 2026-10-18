"use client";
import { useEffect, useState } from "react";
import { FAILED, shown, type Failed, type Loaded } from "@/app/admin/load-state";

/**
 * A Server Function load for the admin pages, asked again whenever `version` changes (#183). Undefined while on its
 * way, FAILED when no answer came (shown with 重试), else the answer. `load` must be the same function every render
 * (a Server Function imported at the top).
 */
export function useAdminLoad<T>(load: () => Promise<T>, version: number): T | Failed | undefined {
  const [loaded, setLoaded] = useState<Loaded<T>>();
  useEffect(() => {
    let live = true;
    load().then(
      (value) => {
        if (live) setLoaded({ version, value });
      },
      () => {
        if (live) setLoaded({ version, value: FAILED });
      },
    );
    return () => {
      live = false;
    };
  }, [load, version]);
  return shown(loaded, version);
}
