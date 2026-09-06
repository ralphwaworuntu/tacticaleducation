import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarState = {
  isOpen: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      isMobileOpen: false,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (isOpen) => set({ isOpen }),
      toggleMobile: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
      setMobileOpen: (isMobileOpen) => set({ isMobileOpen }),
    }),
    {
      name: 'dashboard-sidebar',
      partialize: (state) => ({ isOpen: state.isOpen }),
    },
  ),
);
