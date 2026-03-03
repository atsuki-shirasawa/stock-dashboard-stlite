import { createContext, useContext, useEffect, useState } from "react";
import type { Theme, ThemeMode } from "../constants";
import { DARK_THEME, LIGHT_THEME } from "../constants";

export const ThemeContext = createContext<Theme>(LIGHT_THEME);

export function useTheme(): Theme {
	return useContext(ThemeContext);
}

interface ThemeProviderProps {
	mode: ThemeMode;
	children: React.ReactNode;
}

export function ThemeProvider({ mode, children }: ThemeProviderProps) {
	const [systemDark, setSystemDark] = useState(
		() => window.matchMedia("(prefers-color-scheme: dark)").matches,
	);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const resolved = mode === "auto" ? (systemDark ? "dark" : "light") : mode;
	const theme = resolved === "dark" ? DARK_THEME : LIGHT_THEME;

	return (
		<ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
	);
}
