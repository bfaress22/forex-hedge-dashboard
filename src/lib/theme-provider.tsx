import React, { createContext, useContext, useEffect, useState } from "react";
import { bloombergTheme, bloombergFonts } from "./theme-bloomberg";

type Theme = "default" | "dark" | "bloomberg";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isBloomberg: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "default",
  setTheme: () => null,
  isBloomberg: false,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme;
    return savedTheme || "default";
  });

  const isBloomberg = theme === "bloomberg";

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("dark", "bloomberg");

    if (theme === "dark") {
      root.classList.add("dark");
      // Réinitialiser la police pour le thème dark
      root.style.fontFamily = "";
      document.body.style.fontFamily = "";
    } else if (theme === "bloomberg") {
      root.classList.add("bloomberg");
      
      // Appliquer la police Bloomberg
      root.style.fontFamily = bloombergFonts.sans;
      document.body.style.fontFamily = bloombergFonts.sans;
    } else {
      // Réinitialiser la police pour le thème default
      root.style.fontFamily = "";
      document.body.style.fontFamily = "";
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isBloomberg }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}; 