"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** The browser's own print dialog; its 存为 PDF is how a resume becomes a PDF file (no PDF library, #86). */
export function PrintButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <Button variant={variant} onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden="true" className="size-4" />
      打印 / 存为 PDF
    </Button>
  );
}
