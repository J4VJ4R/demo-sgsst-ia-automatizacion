"use client";

import { cn } from "@/lib/utils";

export function Switch(props: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const disabled = !!props.disabled;
  const checked = !!props.checked;

  return (
    <button
      id={props.id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        props.onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
        checked ? "bg-emerald-500 border-emerald-500" : "bg-slate-200 border-slate-300",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        props.className
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

