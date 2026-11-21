import { useEffect, type RefObject } from "react";
import { navActionForKey, nextNavIndex, padActions, padSnapshot, type NavDir, type PadSnapshot } from "@/game/menu/nav";

const ITEMS = "button, input, select, textarea, a[href]";
const STEP = 120;

function isTyping(el: Element | null) {
  if (!el) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || (el as HTMLElement).isContentEditable;
}

/**
 * Up / Down (arrows, W / S, gamepad d-pad or stick) move a highlight through
 * every button in a scrolling menu and scroll it into view; Enter / Space /
 * gamepad A press it. Locked (disabled) rows are still visited so you can see
 * them. Past the last button, Down keeps scrolling to the bottom of the menu.
 * `activate: false` = scroll only (credits, where Space already means "main menu").
 */
export function useMenuNav(ref: RefObject<HTMLElement | null>, opts: { activate?: boolean; enabled?: boolean } = {}) {
  const activate = opts.activate ?? true;
  const enabled = opts.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    let current: HTMLElement | null = null;

    const items = () => {
      const root = ref.current;
      if (!root) return [];
      return [...root.querySelectorAll<HTMLElement>(ITEMS)].filter((el) => el.getClientRects().length > 0);
    };
    const mark = (el: HTMLElement | null) => {
      current?.removeAttribute("data-nav-active");
      current = el;
      if (!el) return;
      el.setAttribute("data-nav-active", "");
      if ((el as HTMLButtonElement).disabled) {
        const a = document.activeElement as HTMLElement | null;
        if (a && ref.current?.contains(a)) a.blur();
      } else el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
    };
    const move = (dir: NavDir) => {
      const root = ref.current;
      if (!root) return;
      const list = items();
      const at = current ? list.indexOf(current) : list.indexOf(document.activeElement as HTMLElement);
      const next = nextNavIndex(at, list.length, dir);
      if (next === at || next < 0) {
        // At the first / last button (or none): scroll the rest of the menu (headings, tallies, credits).
        root.scrollBy({ top: dir * STEP, behavior: "auto" });
        return;
      }
      mark(list[next]);
      if (next === 0) root.scrollTo({ top: 0 });
    };
    const press = () => {
      if (!activate || !current || !ref.current?.contains(current)) return false;
      if ((current as HTMLButtonElement).disabled) return true;
      current.click();
      return true;
    };

    const onKey = (e: KeyboardEvent) => {
      const a = navActionForKey(e.code);
      if (!a) return;
      const typing = isTyping(e.target as Element | null);
      if (typing && !(a.kind === "move" && e.code.startsWith("Arrow"))) return;
      if (a.kind === "move") {
        e.preventDefault();
        move(a.dir);
      } else if (!e.repeat && press()) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);

    let prev: PadSnapshot = padSnapshot(navigator.getGamepads?.() ?? []);
    let raf = 0;
    const poll = () => {
      const now = padSnapshot(navigator.getGamepads?.() ?? []);
      for (const a of padActions(prev, now)) {
        if (!a) continue;
        if (a.kind === "move") move(a.dir);
        else press();
      }
      prev = now;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      current?.removeAttribute("data-nav-active");
    };
  }, [ref, activate, enabled]);
}
