import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";
import { Monitor, Moon, Sun, Terminal } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const themes = [
    { id: "default", name: "Light", icon: Sun },
    { id: "dark", name: "Dark", icon: Moon },
    { id: "bloomberg", name: "Bloomberg Terminal", icon: Terminal },
  ];

  const currentTheme = themes.find(t => t.id === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Button variant="outline" size="icon">
        <CurrentIcon className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      
      {isHovered && (
        <div 
          className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-[180px] bloomberg:bg-black bloomberg:border-yellow-400"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {themes.map((themeOption) => {
            const IconComponent = themeOption.icon;
            return (
              <button
                key={themeOption.id}
                onClick={() => {
                  setTheme(themeOption.id as any);
                  setIsHovered(false);
                }}
                className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 bloomberg:hover:bg-yellow-900 bloomberg:text-yellow-400 transition-colors ${
                  theme === themeOption.id 
                    ? 'bg-gray-100 dark:bg-gray-700 bloomberg:bg-yellow-900' 
                    : ''
                }`}
              >
                <IconComponent className="mr-2 h-4 w-4" />
                <span>{themeOption.name}</span>
                {theme === themeOption.id && (
                  <span className="ml-auto text-xs bloomberg:text-yellow-400">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher; 