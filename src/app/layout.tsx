import type { Metadata } from "next";

import "./globals.css";
import { ErrorSuppressor } from "./components/ErrorSuppressor";

export const metadata: Metadata = {
  title: "Voice UI Kit - Simple Chatbot",
  icons: { icon: "/pipecat.svg" },
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
