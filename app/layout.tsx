import type { Metadata } from "next";
import "./globals.css";
import { PageBackground } from "@/components/ui/PageBackground";

export const metadata: Metadata = {
  title: "מערכת כתיבה חכמה",
  description: "מרעיון מעורפל לכתבה ברורה – בלי בלגן",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Assistant:wght@400;500;600;700&family=Rubik:wght@400;500;600;700&family=Secular+One&family=Alef:wght@400;700&family=David+Libre:wght@400;500;700&family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased bg-[var(--background)] text-[var(--foreground)] font-sans">
        <PageBackground />
        {children}
      </body>
    </html>
  );
}
