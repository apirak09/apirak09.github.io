import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liar Table — A private table for your friends",
  description: "Bluff, call, and survive. Classic cards for 2–4 friends across phones, tablets and computers.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
