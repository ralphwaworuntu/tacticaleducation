import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AdminSidebarState = {
  isOpen: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
};

export const useAdminSidebarStore = create<AdminSidebarState>()(
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
      name: 'admin-sidebar',
      partialize: (state) => ({ isOpen: state.isOpen }),
    },
  ),
);
