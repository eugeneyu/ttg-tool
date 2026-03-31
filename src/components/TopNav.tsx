import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity, Settings as SettingsIcon, List } from "lucide-react";
import { cn } from "@/lib/utils";

function LinkItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-zinc-800 text-zinc-50"
            : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50",
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export default function TopNav() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-800" />
          <div>
            <div className="text-sm font-semibold leading-tight">TTG Assistant</div>
            <div className="text-xs text-zinc-400 leading-tight">Crawl, filter, export</div>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <LinkItem to="/" icon={<Activity className="h-4 w-4" />} label="Dashboard" />
          <LinkItem to="/run-log" icon={<List className="h-4 w-4" />} label="Run Log" />
          <LinkItem to="/settings" icon={<SettingsIcon className="h-4 w-4" />} label="Settings" />
        </nav>
      </div>
    </header>
  );
}
