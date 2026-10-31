"use client";
import { useState, type ReactNode } from "react";
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { useSwapFocus } from "@/components/ui/use-swap-focus";

/**
 * A card action that cannot be taken back with one press (下架, 驳回举报): the first press only asks, and 确定… with
 * 取消 take the button's place, with the focus (#189, as 封禁雇主 does); 取消 brings the focus back.
 */
export function ConfirmButton({
  variant,
  confirmVariant,
  disabled,
  loading,
  confirmLabel,
  onConfirm,
  children,
}: {
  variant: ButtonVariant;
  confirmVariant: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const { opener, form } = useSwapFocus<HTMLSpanElement, HTMLSpanElement>(confirming);
  return confirming ? (
    <span ref={form} className="contents">
      <Button
        variant={confirmVariant}
        disabled={disabled}
        loading={loading}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Cancel onClick={() => setConfirming(false)} />
    </span>
  ) : (
    <span ref={opener} className="contents">
      <Button variant={variant} disabled={disabled} loading={loading} onClick={() => setConfirming(true)}>
        {children}
      </Button>
    </span>
  );
}
