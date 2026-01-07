import type { Metadata, Viewport } from "next";

import "./globals.css";
import { ErrorSuppressor } from "./components/ErrorSuppressor";

export const metadata: Metadata = {
  title: "Voice AI",
  description: "Retro-styled voice AI assistant",
  icons: {
    icon: "/icon-192.svg",
    apple: "/apple-touch-icon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Voice AI",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ErrorSuppressor />
        {children}
      </body>
    </html>
  );
}
