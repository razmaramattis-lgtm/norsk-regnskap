import { createContext, useContext } from "react";

export const Bokforingsmodus = createContext<(aktiv: boolean) => void>(() => {});

export function useBokforingsmodus() {
  return useContext(Bokforingsmodus);
}