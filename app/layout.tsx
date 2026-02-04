import type { Metadata } from "next";
import "./globals.css";
import { PageBackground } from "@/components/ui/PageBackground";

export const metadata: Metadata = {
  title: "עוזר כתיבה AI",
  description: "בואו נתחיל בתהליך היצירה – עוזר כתיבה AI",
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
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+Hebrew:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased text-foreground font-sans">
        <div className="relative flex min-h-screen w-full flex-col gradient-mesh overflow-x-hidden">
          <PageBackground />
          {children}
        </div>
      </body>
    </html>
  );
}
