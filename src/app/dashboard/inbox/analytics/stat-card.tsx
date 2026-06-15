import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  description: string;
  icon: LucideIcon;
  title: string;
  value: number | string;
};

export default function StatCard({
  description,
  icon: Icon,
  title,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
    </div>
  );
}
