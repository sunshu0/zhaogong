"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * 去官网申请 on a demo job (isDemoCompany): there is no company site behind it, so the button says so here instead of
 * opening a made-up address. The page passes the words, so the dictionary stays on the server.
 */
export function DemoApply({ label, note }: { label: string; note: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <Button
        size="lg"
        block
        className="font-semibold whitespace-nowrap md:w-auto"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
      >
        {label}
      </Button>
      <p id={id} role="status" className={open ? "mt-2 text-meta text-muted" : "sr-only"}>
        {open ? note : ""}
      </p>
    </>
  );
}
