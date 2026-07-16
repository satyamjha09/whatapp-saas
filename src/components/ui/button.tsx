import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "success"
    | "link";
  size?: "sm" | "default" | "lg" | "icon";
  isLoading?: boolean;
};

const variants = {
  default:
    "bg-primary text-primary-foreground shadow-[0_12px_26px_rgba(18,140,126,0.22)] hover:bg-primary-hover",
  destructive:
    "bg-destructive text-destructive-foreground shadow-[0_12px_26px_rgba(225,29,72,0.18)] hover:brightness-95",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-primary",
  link: "h-auto rounded-none p-0 text-primary underline-offset-4 shadow-none hover:underline",
  outline:
    "border border-border bg-card text-primary hover:border-primary/35 hover:bg-secondary",
  secondary:
    "border border-border bg-secondary text-secondary-foreground hover:bg-secondary-hover",
  success:
    "bg-success text-success-foreground shadow-[0_12px_26px_rgba(22,163,74,0.18)] hover:brightness-95",
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
      children,
      disabled,
      isLoading = false,
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
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
