"use client";

export function ShareButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        if (navigator.share) {
          navigator.share({ title: "PisoQuest receipt", text });
        } else {
          navigator.clipboard.writeText(text).catch(() => {});
        }
      }}
      className="grid min-h-[44px] w-full place-items-center rounded-lg bg-section text-[14px] font-medium text-white transition-colors hover:bg-section-glow"
    >
      Share this receipt
    </button>
  );
}
