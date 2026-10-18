"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/** The browser's own print dialog; its 存为 PDF is how a resume becomes a PDF file (no PDF library, #86). */
export function PrintButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const t = useMessages(uiMessages);
  return (
    <Button variant={variant} onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden="true" className="size-4" />
      {t.print}
    </Button>
  );
}
