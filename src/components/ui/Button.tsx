import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
};

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const sizes = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  const variants =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-500"
      : variant === "danger"
        ? "bg-rose-600 text-white hover:bg-rose-500"
        : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700";

  return <button className={cn(base, sizes, variants, className)} {...props} />;
}
