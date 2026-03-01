import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MASEVEN Tracker | Feueralarm Statistik",
  description: "Der inoffizielle Feueralarm-Tracker für das MASEVEN Frankfurt. Checke aktuelle Alarme, Statistiken und Durchschnittswerte.",
  keywords: ["MASEVEN", "Frankfurt", "Feueralarm", "Tracker", "Statistik", "Hotel", "Alarm", "Maseven brennt"],
  authors: [{ name: "Dein Name oder Nickname" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0a] text-white`} 
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
