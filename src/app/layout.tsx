import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workflowz - Visual Workflow Tracking",
  description: "Track projects with visual workflow canvases and share real-time progress with clients",
  icons: { icon: "/workflowz/icon.svg" },
  openGraph: {
    title: "Workflowz - Visual Workflow Tracking",
    description: "Track projects with visual workflow canvases and share real-time progress with clients",
    siteName: "Workflowz",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
