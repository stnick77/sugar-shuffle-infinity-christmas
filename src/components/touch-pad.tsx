import type { PointerEvent } from "react";
import { twMerge } from "tailwind-merge";
import { setTouch } from "@/game/input";

function PadBtn({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  const press = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setTouch(code, true);
  };
  const release = (e: PointerEvent) => {
    e.preventDefault();
    setTouch(code, false);
  };
  return (
    <button
      type="button"
      className={twMerge(
        "h-12 w-12 select-none rounded-[18px] border border-cream/15 bg-ink/45 text-cream shadow-[0_6px_0_#00000055] sm:h-14 sm:w-14 " +
          "text-xs font-extrabold uppercase tracking-wide active:translate-y-0.5 active:shadow-none sm:text-sm",
        className,
      )}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      {label}
    </button>
  );
}

/** On-screen controls. Only shown on touch screens; keyboard and gamepad players don't need them. */
export function TouchPad() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden items-end justify-between gap-2 p-2 pb-[max(10px,env(safe-area-inset-bottom))] pointer-coarse:flex md:p-4">
      <div className="pointer-events-auto grid grid-cols-3 gap-1.5 sm:gap-2">
        <span />
        <PadBtn code="ArrowUp" label="Up" />
        <span />
        <PadBtn code="ArrowLeft" label="◀" />
        <PadBtn code="ArrowDown" label="Down" className="text-[10px] sm:text-xs" />
        <PadBtn code="ArrowRight" label="▶" />
      </div>
      <div className="pointer-events-auto grid grid-cols-3 gap-1.5 sm:gap-2">
        <PadBtn code="KeyQ" label="Spec" className="bg-mint/35 text-[10px] sm:text-xs" />
        <PadBtn code="ShiftLeft" label="Run" />
        <span />
        <PadBtn code="KeyJ" label="Hit" className="bg-candy/70 text-ink" />
        <PadBtn code="Space" label="Jump" className="col-span-2 w-full bg-cream/90 text-ink" />
      </div>
      <p className="pointer-events-none absolute inset-x-0 top-[-2rem] hidden text-center text-xs text-cream-dim portrait:block">
        Turn your phone sideways for a bigger view
      </p>
    </div>
  );
}
