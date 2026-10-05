"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type AdminViewContextValue = {
  isAdminView: boolean;
  toggle: () => void;
};

const AdminViewContext = createContext<AdminViewContextValue>({
  isAdminView: true,
  toggle: () => {},
});

export function AdminViewProvider({ children }: { children: React.ReactNode }) {
  const [isAdminView, setIsAdminView] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("adminView");
    if (stored === "false") setIsAdminView(false);
  }, []);

  const toggle = useCallback(() => {
    setIsAdminView((prev) => {
      const next = !prev;
      localStorage.setItem("adminView", String(next));
      return next;
    });
  }, []);

  return (
    <AdminViewContext.Provider value={{ isAdminView, toggle }}>
      {children}
    </AdminViewContext.Provider>
  );
}

export function useAdminView() {
  return useContext(AdminViewContext);
}
