/**
 * UI for Sugar Shuffle Infinity + DLC: 'Tis the Seasones.
 * Everything renders nothing (or just the DLC button) while the DLC is off.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Music, Snowflake, Users } from "lucide-react";
import { useGame } from "@/store/game-store";
import { sfx, unlockAudio } from "@/game/audio";
import { HEROES, type HeroId } from "@/game/data/world";
import {
  COLLECTABLES,
  DECEMBER_GIFT_ID,
  DLC_TITLE,
  HOME_NAME,
  cosmeticById,
  cosmeticsFor,
  dlcNow,
  isDecember,
  isEquipped,
  isOwned,
  toggleDlc,
  toggleEquip,
  type Cosmetic,
} from "@/game/dlc/logic";
import { AREA_THEMES, LICENSED_SLOTS, ORIGINAL_THEMES, PUBLIC_DOMAIN_CAROLS } from "@/game/dlc/carols";
import { checkDecemberGift, setXmas } from "@/game/dlc/state";
import { licensedFile, loadLicensedManifest, restartMusic } from "@/game/dlc/xmasMusic";

/**
 * Saves live in localStorage, which the server render can't see. Render the
 * DLC as "off" until after hydration so server and client HTML match.
 */
export function useXmasOn() {
  const on = useGame((s) => s.save.dlc.xmas.enabled);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated && on;
}

/** One 128px frame of a 2x2 sprite sheet as a CSS background. */
export function XIcon({ sheet, frame, size = 40 }: { sheet: "xmas-pickups" | "xmas-cosmetics"; frame: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundImage: `url('/game/sprites/${sheet}.png')`,
        backgroundSize: "200% 200%",
        backgroundPosition: `${frame % 2 ? "100%" : "0%"} ${frame >= 2 ? "100%" : "0%"}`,
      }}
    />
  );
}

function XBtn({ children, onClick, tone = "solid", disabled }: { children: ReactNode; onClick?: () => void; tone?: "solid" | "ghost"; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 font-extrabold disabled:opacity-40 " +
        (tone === "solid" ? "bg-cream text-ink" : "border border-cream/15 bg-transparent text-cream")
      }
    >
      {children}
    </button>
  );
}

/** Main-menu DLC button. Press to enable, press again (while active) to disable. */
export function XmasButton() {
  const on = useXmasOn();
  const setToast = useGame((s) => s.setToast);
  return (
    <button
      type="button"
      data-testid="dlc-button"
      aria-pressed={on}
      onClick={() => {
        unlockAudio(useGame.getState().save.settings);
        sfx.ui();
        setXmas(toggleDlc);
        if (!on) {
          const gift = checkDecemberGift();
          setToast(gift || `DLC on: ${DLC_TITLE}`);
          sfx.win();
        } else setToast("DLC off");
        restartMusic();
      }}
      className={
        "relative inline-flex h-14 items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 font-extrabold transition " +
        (on ? "border-mint/60 bg-[linear-gradient(90deg,#d12d5c,#1f6b3a)] text-cream" : "border-cream/25 bg-ink/60 text-cream")
      }
    >
      <span className="flex items-center gap-2">
        <XIcon sheet="xmas-pickups" frame={0} size={30} />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-cream-dim">DLC</span>
          {DLC_TITLE}
        </span>
      </span>
      <span className={"rounded-full px-2 py-0.5 text-xs " + (on ? "bg-cream text-ink" : "border border-cream/30")}>{on ? "ON" : "OFF"}</span>
    </button>
  );
}

export function XmasTitleExtras() {
  return (
    <div className="mt-2 flex items-center gap-2" data-testid="dlc-title">
      <XIcon sheet="xmas-pickups" frame={2} size={34} />
      <p className="font-display text-2xl tracking-tight text-mint sm:text-3xl">+ DLC: {DLC_TITLE}</p>
      <XIcon sheet="xmas-pickups" frame={0} size={34} />
    </div>
  );
}

function CosmeticRow({ c, hero }: { c: Cosmetic; hero: HeroId }) {
  const x = useGame((s) => s.save.dlc.xmas);
  const owned = isOwned(x, c.id);
  const worn = isEquipped(x, hero, c.id);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-cream/10 bg-surface p-3">
      <XIcon sheet={c.icon.sheet} frame={c.icon.frame} size={44} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight">{c.name}</p>
        <p className="text-xs text-cream-dim">{owned ? c.blurb : "Locked — play in December to unlock this free cosmetic."}</p>
      </div>
      <XBtn
        tone={worn ? "solid" : "ghost"}
        disabled={!owned}
        onClick={() => {
          sfx.ui();
          setXmas((s) => toggleEquip(s, hero, c.id));
          void import("@/game/phaserGame").then((m) => m.getPlay()?.refreshCosmetics());
        }}
      >
        {worn ? "Equipped" : "Equip"}
      </XBtn>
    </li>
  );
}

/** Pumpkin station section: equip Christmas cosmetics + see collectables. */
export function XmasCloset() {
  const on = useXmasOn();
  if (!on) return null;
  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="xmas-closet">
      <h3 className="font-display text-2xl">Christmas closet</h3>
      <p className="text-sm text-cream-dim">{DLC_TITLE} cosmetics. Equip them here, they show up as soon as you close the station.</p>
      {(["cuboe", "cubro"] as HeroId[]).map((hero) => (
        <div key={hero}>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-candy">{HEROES[hero].name}</p>
          <ul className="flex flex-col gap-2">
            {cosmeticsFor(hero).map((c) => (
              <CosmeticRow key={c.id} c={c} hero={hero} />
            ))}
          </ul>
        </div>
      ))}
      <CollectableTally />
    </div>
  );
}

export function CollectableTally() {
  const x = useGame((s) => s.save.dlc.xmas);
  return (
    <div className="rounded-2xl border border-cream/10 bg-surface p-3">
      <p className="text-xs font-extrabold uppercase tracking-widest text-candy">Christmas collectables · {x.points.toLocaleString()} pts</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {(Object.keys(COLLECTABLES) as (keyof typeof COLLECTABLES)[]).map((k) => (
          <div key={k} className="flex flex-col items-center">
            <XIcon sheet="xmas-pickups" frame={COLLECTABLES[k].frame} size={40} />
            <p className="font-display text-sm">{COLLECTABLES[k].name}</p>
            <p className="text-xs text-cream-dim">
              {COLLECTABLES[k].points} pts · ×{x.collected[k]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** DLC options menu: Christmas music, song picker, co-op, home, December gift. */
export function XmasOptions({ onClose, onHome, inGame }: { onClose: () => void; onHome: () => void; inGame: boolean }) {
  const x = useGame((s) => s.save.dlc.xmas);
  const [, force] = useState(0);
  useEffect(() => {
    void loadLicensedManifest().then(() => force((n) => n + 1));
  }, []);
  const now = dlcNow();
  const gift = cosmeticById(DECEMBER_GIFT_ID)!;
  const pick = (track: string) => {
    sfx.ui();
    setXmas((s) => ({ ...s, track, music: true }));
    unlockAudio(useGame.getState().save.settings);
    restartMusic();
  };
  const SongBtn = ({ id, title, note, disabled }: { id: string; title: string; note?: string; disabled?: boolean }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => pick(id)}
      className={
        "rounded-2xl border px-3 py-2 text-left disabled:opacity-40 " +
        (x.track === id ? "border-mint/70 bg-mint/15" : "border-cream/12 bg-surface")
      }
    >
      <p className="font-display text-base leading-tight">{title}</p>
      {note && <p className="text-xs text-cream-dim">{note}</p>}
    </button>
  );
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-ink px-4 py-16" data-testid="xmas-options">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
        <h2 className="font-display text-4xl">Options</h2>
        <p className="text-sm text-cream-dim">DLC: {DLC_TITLE}</p>

        <section className="flex flex-col gap-2 rounded-2xl border border-cream/10 p-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-display text-xl">
              <Music className="size-5" /> Christmas music
            </p>
            <XBtn
              tone={x.music ? "solid" : "ghost"}
              onClick={() => {
                sfx.ui();
                setXmas((s) => ({ ...s, music: !s.music }));
                unlockAudio(useGame.getState().save.settings);
                restartMusic();
              }}
            >
              {x.music ? "On" : "Off"}
            </XBtn>
          </div>
          <p className="text-xs text-cream-dim">Plays in levels, bosses, the hub, the main menu and the house.</p>
          <SongBtn id={AREA_THEMES} title="Area themes (by Hayden)" note="Ready Up on the menu, Peaceful Home in the house, plus the Hub, Level and Boss Themes" />
          <p className="mt-1 text-xs font-extrabold uppercase tracking-widest text-candy">Hayden&apos;s tracks</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ORIGINAL_THEMES.map((t) => (
              <SongBtn key={t.id} id={t.id} title={t.title} note={t.style} />
            ))}
          </div>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-widest text-candy">Classic carols</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PUBLIC_DOMAIN_CAROLS.map((t) => (
              <SongBtn key={t.id} id={t.id} title={t.title} note="Public-domain carol, chiptune" />
            ))}
          </div>
          <p className="mt-1 text-xs font-extrabold uppercase tracking-widest text-candy">Bonus songs</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {LICENSED_SLOTS.map((t) => {
              const file = licensedFile(t.id);
              return <SongBtn key={t.id} id={t.id} title={t.title} disabled={!file} note={file ? "Licensed file" : "Empty slot — needs a licensed file"} />;
            })}
          </div>
        </section>

        <section className="flex items-center justify-between gap-3 rounded-2xl border border-cream/10 p-3">
          <div>
            <p className="flex items-center gap-2 font-display text-xl">
              <Users className="size-5" /> Co-op
            </p>
            <p className="text-xs text-cream-dim">
              Up to 2 players on one keyboard. P1: WASD + Space/K jump + J hit. P2: Arrows + Enter jump + / hit + Right Shift run. Or two gamepads.
              {inGame ? " Takes effect next time a room loads." : ""}
            </p>
          </div>
          <div className="flex gap-1">
            {[1, 2].map((n) => (
              <XBtn
                key={n}
                tone={(x.coop ? 2 : 1) === n ? "solid" : "ghost"}
                onClick={() => {
                  sfx.ui();
                  setXmas((s) => ({ ...s, coop: n === 2 }));
                }}
              >
                {n}P
              </XBtn>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-3 rounded-2xl border border-cream/10 p-3">
          <XIcon sheet="xmas-cosmetics" frame={3} size={44} />
          <div className="flex-1">
            <p className="flex items-center gap-2 font-display text-xl">
              <Snowflake className="size-5" /> December gift
            </p>
            <p className="text-xs text-cream-dim" data-testid="december-status">
              {isOwned(x, gift.id)
                ? `Unlocked: ${gift.name}. Equip it at the pumpkin station.`
                : isDecember(now)
                  ? `It's December! ${gift.name} unlocks now.`
                  : `Play in December to get a free cosmetic (${gift.name}).`}
            </p>
          </div>
        </section>

        <CollectableTally />

        <XBtn onClick={onHome}>Visit {HOME_NAME}</XBtn>
        <XBtn tone="ghost" onClick={onClose}>
          Back
        </XBtn>
      </div>
    </div>
  );
}
