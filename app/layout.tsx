import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ScriptSwitcher from "./script-switcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://glas-za-reforme.copperfly3.chatgpt.site"),
  title: "Glas za reforme — dobre ideje za bolju državu",
  description: "Platforma na kojoj građani predlažu, ocenjuju i podržavaju ideje za reforme u Srbiji.",
  openGraph: {
    title: "Glas za reforme",
    description: "Dobri predlozi. Bolja država.",
    images: [{ url: "/og.png", width: 1730, height: 909, alt: "Glas za reforme" }],
  },
  twitter: { card: "summary_large_image", title: "Glas za reforme", description: "Dobri predlozi. Bolja država.", images: ["/og.png"] },
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
    <html lang="sr-Latn">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ScriptSwitcher />
      </body>
    </html>
  );
}
