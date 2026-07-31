"use client";

import { createContext, useContext } from "react";

/**
 * State drawer sidebar (chia sẻ giữa (app)/layout, Sidebar, UcHeader).
 * Chỉ có ý nghĩa dưới breakpoint lg — desktop sidebar luôn hiện, `open` bị bỏ qua.
 */
export const SidebarContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);
