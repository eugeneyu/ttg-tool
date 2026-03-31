import { type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Textarea({ className, ...props }: Props) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600",
        className,
      )}
      {...props}
    />
  );
}
