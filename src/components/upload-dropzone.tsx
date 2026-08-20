"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UploadedFile {
  path: string;
  name: string;
  size: number;
  kind: "photo" | "video" | "file";
}

export function UploadDropzone({
  accept,
  maxSizeMB,
  multiple = true,
  kind = "file",
  label,
  hint,
  files,
  onChange,
  disabled,
}: {
  accept: string;
  maxSizeMB: number;
  multiple?: boolean;
  kind?: UploadedFile["kind"];
  label: string;
  hint?: string;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const upload = useCallback(
    async (list: FileList | File[]) => {
      const chosen = Array.from(list);
      setError(null);
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid = user?.id ?? "anon";
      const ok: UploadedFile[] = [];
      const done: Record<string, number> = {};

      for (const file of chosen) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(`${file.name} is over ${maxSizeMB}MB.`);
          continue;
        }
        const path = `${uid}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("proofs")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) {
          setError(`Upload failed for ${file.name} — check your connection and retry.`);
          continue;
        }
        done[path] = 100;
        setProgress({ ...done });
        ok.push({ path, name: file.name, size: file.size, kind });
      }

      setProgress(done);
      setBusy(false);
      if (ok.length) onChange([...files, ...ok]);
    },
    [files, kind, maxSizeMB, onChange],
  );

  function remove(path: string) {
    onChange(files.filter((f) => f.path !== path));
  }

  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center justify-between gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-[12px] text-neutral-400"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-400)" strokeWidth="2" className="flex-none">
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
                <span className="truncate">{f.name}</span>
                <span className="text-neutral-600">
                  {(f.size / 1024 / 1024).toFixed(1)}MB
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(f.path)}
                className="flex-none rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-bad"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-700 bg-surface px-4 text-center transition-colors hover:border-accent disabled:opacity-45"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-400)" strokeWidth="2" strokeLinecap="round">
          <path d="M12 16V4M6 10l6-6 6 6" />
          <path d="M4 20h16" />
        </svg>
        <span className="text-[13px] font-medium text-neutral-300">
          {busy ? "Uploading…" : label}
        </span>
        {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />

      {error && <p className="text-[12px] text-bad">{error}</p>}
      {Object.keys(progress).length > 0 && busy && (
        <p className="text-[11px] text-neutral-500">Uploading…</p>
      )}
    </div>
  );
}
