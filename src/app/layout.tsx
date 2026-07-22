import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { FetchAuthInstaller } from "@/components/FetchAuthInstaller";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Vĩnh Giang WMS",
  description: "Hệ thống quản lý kho",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VG WMS",
  },
};

// MT-01: khoa zoom de giao dien giong app (khong pinch/double-tap phong to).
// Ket hop input >=16px (globals.css) de iOS khong tu zoom khi focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#001E71",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen text-on-surface antialiased bg-bg">
        <FetchAuthInstaller />
        <ConfirmProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ConfirmProvider>
      </body>
    </html>
  );
}
