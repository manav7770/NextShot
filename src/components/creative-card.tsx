"use client";

import Image from "next/image";
import type { CreativeRecommendation } from "@/types/creative";

interface CreativeCardProps {
  recommendation: CreativeRecommendation;
  rank: number;
}

export function CreativeCard({ recommendation, rank }: CreativeCardProps) {
  const r = recommendation;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-ink-soft/60 p-5 shadow-sm transition hover:border-white/20">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-accent">
              #{rank}
            </span>
            <span className="rounded-md border border-white/15 px-2 py-0.5 text-xs uppercase tracking-wider text-white/70">
              Slot {r.slotNumber}
            </span>
            <span className="text-xs text-white/50">{r.slotPurpose}</span>
          </div>
          <h3 className="text-lg font-semibold leading-tight">
            {r.creativeTitle}
          </h3>
        </div>
        <div className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          {Math.round(r.priorityScore)}
        </div>
      </header>

      {r.generatedImageUrl ? (
        <section className="relative aspect-[1/1] w-full overflow-hidden rounded-lg border border-white/10 bg-white p-4">
          {r.generatedImageUrl.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.generatedImageUrl}
              alt={r.creativeTitle}
              className="absolute inset-0 m-auto h-full w-full object-contain p-4"
            />
          ) : (
            <Image
              src={r.generatedImageUrl}
              alt={r.creativeTitle}
              fill
              className="object-contain p-4"
              unoptimized
            />
          )}
        </section>
      ) : null}

      <section>
        <p className="text-sm text-white/80">{r.whyThisMatters}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs uppercase tracking-wider text-white/50">
          On-image text
        </h4>
        <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-3 font-sans text-base font-medium leading-snug">
          {r.onImageText}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs uppercase tracking-wider text-white/50">
          Visual direction
        </h4>
        <p className="text-sm text-white/80">{r.visualDescription}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs uppercase tracking-wider text-white/50">
          Why this beats the gap
        </h4>
        <p className="text-sm text-white/70">{r.rationale}</p>
      </section>
    </article>
  );
}
