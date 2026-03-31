import Button from "@/components/ui/Button";
import { AlertTriangle, X } from "lucide-react";

export default function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-rose-200">Error</div>
            <div className="text-sm text-rose-200/80 break-words">{message}</div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </div>
  );
}
