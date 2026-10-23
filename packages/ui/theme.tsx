"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
export type Theme = "light" | "dark" | "system";
type Appearance = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
};
const Context = createContext<Appearance | null>(null);
function resolve(theme: Theme) {
  return theme === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;
}
export function ThemeProvider({
  children,
  storageKey = "lifehq-appearance",
}: {
  children: React.ReactNode;
  storageKey?: string;
}) {
  const [theme, update] = useState<Theme>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const setTheme = useCallback(
    (next: Theme) => {
      update(next);
      const mode = resolve(next);
      setResolved(mode);
      document.documentElement.dataset.theme = mode;
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* Appearance also works without persistent storage. */
      }
    },
    [storageKey],
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setTheme(saved === "dark" || saved === "system" ? saved : "light");
    } catch {
      setTheme("light");
    }
    const media = matchMedia("(prefers-color-scheme: dark)");
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey)
        setTheme(
          e.newValue === "dark" || e.newValue === "system"
            ? e.newValue
            : "light",
        );
    };
    window.addEventListener("storage", handleStorage);
    const onSystem = () => {
      if (document.documentElement.dataset.appearance === "system") {
        const mode = media.matches ? "dark" : "light";
        document.documentElement.dataset.theme = mode;
        setResolved(mode);
      }
    };
    media.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("storage", handleStorage);
      media.removeEventListener("change", onSystem);
    };
  }, [setTheme, storageKey]);
  useEffect(() => {
    document.documentElement.dataset.appearance = theme;
  }, [theme]);
  return (
    <Context.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </Context.Provider>
  );
}
export function useTheme() {
  const context = useContext(Context);
  if (!context) throw new Error("ThemeProvider is required");
  return context;
}
export function ThemeToggle({
  onChange,
}: {
  onChange?: (theme: "light" | "dark") => void;
}) {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="Dark theme"
      aria-checked={dark}
      title={`Switch to ${dark ? "light" : "dark"} theme`}
      onClick={() => {
        const next = dark ? "light" : "dark";
        setTheme(next);
        onChange?.(next);
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        {dark ? (
          <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        )}
      </svg>
      <span className="theme-toggle-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
