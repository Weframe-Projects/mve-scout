import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVE Scout",
  description: "Talent scouting tool for MVE Management",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface">
        {children}
      </body>
    </html>
  );
}
