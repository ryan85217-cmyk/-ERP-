import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-slate-100 text-slate-700",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProductThumb({
  name,
  imageUrl,
  className,
  colorKey,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  colorKey?: string;
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={cn("size-10 shrink-0 rounded-lg border object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        PALETTE[hash(colorKey ?? name) % PALETTE.length],
        className,
      )}
      aria-hidden
    >
      {name.slice(0, 1)}
    </div>
  );
}
