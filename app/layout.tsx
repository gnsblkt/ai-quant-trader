import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "QuantLab — Research Studio",
  description: "A responsive historical market replay, paper research journal and quantitative learning workspace.",
  applicationName: "QuantLab",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
