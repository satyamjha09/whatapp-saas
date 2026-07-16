import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Avatar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-secondary text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  alt,
  className,
  sizes = "40px",
  ...props
}: Omit<React.ComponentProps<typeof Image>, "alt" | "fill"> & { alt: string }) {
  return (
    <Image
      alt={alt}
      fill
      className={cn("object-cover", className)}
      sizes={sizes}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center text-sm font-bold",
        className,
      )}
      {...props}
    />
  );
}
