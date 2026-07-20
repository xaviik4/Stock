import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

// No webfont: this app should build and run with the network off.
export const metadata: Metadata = {
  title: "Portfolio Desk",
  description: "Local-only portfolio tracking, equity research, and forecasting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 w-full max-w-[1180px] mx-auto px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-hairline">
          <div className="w-full max-w-[1180px] mx-auto px-5 sm:px-8 py-5 text-xs text-ink-muted">
            Your portfolio and notes are stored in a local SQLite file and never leave
            this machine. The Stock Analyzer queries Yahoo Finance, so the ticker
            symbols you look up are sent to Yahoo — your balances are not.
          </div>
        </footer>
      </body>
    </html>
  );
}
