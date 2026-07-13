import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
};

const variants = {
  default:
    "bg-[#128C7E] text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] hover:bg-[#075E54]",
  destructive:
    "bg-rose-600 text-white shadow-[0_12px_26px_rgba(225,29,72,0.18)] hover:bg-rose-700",
  ghost: "text-[#526173] hover:bg-[#E7F8EF] hover:text-[#128C7E]",
  outline:
    "border border-[#BFE9D0] bg-white text-[#128C7E] hover:border-[#128C7E]/35 hover:bg-[#E7F8EF]",
  secondary:
    "border border-[#BFE9D0] bg-[#E7F8EF] text-[#075E54] hover:bg-[#DFF6EA]",
};

const sizes = {
  default: "h-11 px-4 py-2.5 text-sm",
  icon: "h-10 w-10 p-0",
  lg: "h-12 px-5 py-3 text-sm",
  sm: "h-9 px-3 py-2 text-xs",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      type = "button",
      variant = "default",
      size = "default",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#128C7E]/15",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
