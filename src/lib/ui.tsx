import { createContext, useContext } from 'react';

/** App-wide UI switches the bottom bar drives (filters sheet, contact form). */
export type Ui = {
  filters: boolean;
  setFilters: (v: boolean) => void;
  contact: (subject?: string) => void;
};
export const UiContext = createContext<Ui>({ filters: false, setFilters: () => {}, contact: () => {} });
export const useUi = () => useContext(UiContext);
