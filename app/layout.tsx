import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "QuantReplay — Historical Research Lab", description: "Educational historical market research, candle replay, and multi-target paper simulation." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
