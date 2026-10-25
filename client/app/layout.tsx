import type { Metadata } from "next";
import { AppProvider } from "@/components/providers/app-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: "zehniq. — Learn it. Understand it. Own it.",
  description:
    "Learn it. Understand it. Own it.",
  applicationName: "zehniq.",
  icons: {
    icon: [
      {
        url: "/notebook-roadlm-favicon-light.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/notebook-roadlm-favicon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: "/notebook-roadlm-favicon-light.png",
    apple: [
      {
        url: "/notebook-roadlm-favicon-light.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/notebook-roadlm-favicon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
