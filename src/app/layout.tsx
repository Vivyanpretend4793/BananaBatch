import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BananaBatch",
  description: "One prompt. One batch. Twenty images. Keep the ones you like.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ height: "100%", margin: 0, overflow: "hidden" }}>{children}</body>
    </html>
  );
}
