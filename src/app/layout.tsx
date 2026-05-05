import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon Creative Upgrade Engine",
  description:
    "Paste an Amazon listing. Get the next upgraded hero image to ship — with slot, on-image text, and rationale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
