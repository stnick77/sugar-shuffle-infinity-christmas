import { useGame } from "@/store/game-store";
import { claimDecemberGift, cosmeticById, dlcNow, type XmasSave } from "./logic";

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

/** Hand out the December cosmetic if it's due. Returns a toast message or "". */
export function checkDecemberGift(): string {
  const { state, granted, firstTime } = claimDecemberGift(xmas(), dlcNow());
  if (!granted) return "";
  setXmas(state);
  const name = cosmeticById("candy-cane-scarf")?.name ?? "a cosmetic";
  return firstTime ? `Merry December! Free cosmetic: ${name}` : `Merry December! ${name} is still yours`;
}
