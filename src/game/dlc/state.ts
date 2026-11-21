import { useGame } from "@/store/game-store";
import { claimDecemberGift, dlcNow, type XmasSave } from "./logic";

/** Current DLC save slice. */
export function xmas(): XmasSave {
  return useGame.getState().save.dlc.xmas;
}

export function xmasOn(): boolean {
  return xmas().enabled;
}

export function setXmas(next: XmasSave | ((s: XmasSave) => XmasSave)) {
  const st = useGame.getState();
  const cur = st.save.dlc.xmas;
  const val = typeof next === "function" ? next(cur) : next;
  st.persist({ dlc: { ...st.save.dlc, xmas: val } });
}

/** Stamp the (retired) December gift year if due. Returns a toast or "". */
export function checkDecemberGift(): string {
  const { state, granted } = claimDecemberGift(xmas(), dlcNow());
  if (state !== xmas()) setXmas(state);
  if (!granted) return "";
  return "";
}
