"use client";
import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function FaviconThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const isDark = resolvedTheme === "dark";
    const iconUrl = isDark
      ? "/notebook-roadlm-favicon-dark.png"
      : "/notebook-roadlm-favicon-light.png";

    const existingIcons = document.querySelectorAll<HTMLLinkElement>(
      "link[rel='icon'], link[rel='shortcut icon']",
    );

    if (existingIcons.length > 0) {
      existingIcons.forEach((link) => {
        link.href = iconUrl;
      });
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = iconUrl;
      document.head.appendChild(link);
    }
  }, [resolvedTheme]);

  return null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <FaviconThemeSync />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
