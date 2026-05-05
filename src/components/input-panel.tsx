"use client";

import { useState } from "react";

interface InputPanelProps {
  onSubmit: (input: string) => void;
  loading: boolean;
}

export function InputPanel({ onSubmit, loading }: InputPanelProps) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && value.trim()) onSubmit(value.trim());
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Amazon URL or ASIN (e.g. B0BSQ6HSMT)"
        className="flex-1 rounded-lg border border-white/10 bg-ink-soft px-4 py-3 text-base outline-none transition focus:border-accent"
        disabled={loading}
        aria-label="Amazon URL or ASIN"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="rounded-lg bg-accent px-5 py-3 text-base font-medium text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generating hero…" : "Generate Hero Image"}
      </button>
    </form>
  );
}
