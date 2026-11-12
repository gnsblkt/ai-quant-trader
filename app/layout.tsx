import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "QuantLab — Paper Trading Simulator", description: "A market-data learning lab with simulated portfolio tracking." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
