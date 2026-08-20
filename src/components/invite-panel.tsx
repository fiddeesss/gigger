"use client";

import { useEffect, useState } from "react";

export function InvitePanel({ referralCode }: { referralCode: string }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/?ref=${referralCode}`);
  }, [referralCode]);

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: "PisoQuest — earn real pesos",
        text: "Do small quests, get reviewed, cash out to GCash. 100 pts = ₱1, always. Join me and we both get ₱10 when you finish your first quest!",
        url: link,
      });
    } else {
      await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
      <div className="text-[13.5px] font-medium">Your invite link</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="min-h-[44px] flex-1 rounded-lg border border-divider bg-bg px-3 text-[12.5px] text-neutral-500 outline-none"
        />
        <button
          onClick={copy}
          className="flex-none rounded-lg bg-neutral-900 px-3.5 py-2.5 text-[12.5px] font-medium text-neutral-300 hover:bg-neutral-800"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <button
        onClick={share}
        className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[14.5px] font-medium text-white transition-colors hover:bg-section-glow"
      >
        Share with friends
      </button>
      <p className="text-center text-[10.5px] text-neutral-500">
        Your code: <b className="text-neutral-300">{referralCode}</b> · self-invites
        don&apos;t count · cap {`10`} friends/month
      </p>
    </section>
  );
}
