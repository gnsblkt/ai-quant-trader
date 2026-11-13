import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "QuantLab — Market Data Classroom",
  description: "A responsive, synthetic-data-only classroom for learning chart literacy and data interpretation.",
  applicationName: "QuantLab",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
