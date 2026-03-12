import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { AppProviders } from "@/components/app-providers";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "ProjectStatus - Project Tracking Made Simple",
  description: "Track project progress visually and share real-time updates with clients",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "ProjectStatus - Visual Workflow Tracking",
    description: "Track projects with visual workflow canvases and share real-time progress with clients",
    siteName: "ProjectStatus",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppProviders>{children}</AppProviders>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
