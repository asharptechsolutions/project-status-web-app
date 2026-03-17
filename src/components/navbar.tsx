"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Sun, Moon, Workflow, LogOut, Search } from "lucide-react";
import { openCommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import basePath from "@/lib/base-path";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { isAdmin, signOut, user } = useAuth();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/projects/", label: "Projects" },
    ...(isAdmin ? [
      { href: "/calendar/", label: "Calendar" },
      { href: "/templates/", label: "Templates" },
      { href: "/crm/", label: "CRM" },
      { href: "/activity/", label: "Activity" },
      { href: "/settings/", label: "Settings" },
    ] : []),
  ];

  const isActive = (href: string) => {
    const full = basePath + href;
    if (href === "/") {
      return pathname === full || pathname === full.replace(/\/$/, "");
    }
    return pathname.startsWith(full) || pathname.startsWith(full.replace(/\/$/, ""));
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold mr-8">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Workflow className="h-4 w-4 text-primary" />
          </div>
          <span className="hidden sm:inline tracking-tight">ProjectStatus</span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-full transition-all duration-200",
                isActive(l.href)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full gap-2 text-muted-foreground hidden sm:inline-flex"
            onClick={openCommandPalette}
          >
            <Search className="h-4 w-4" />
            <span className="text-xs">Search...</span>
            <kbd className="pointer-events-none h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 hidden lg:inline-flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full sm:hidden"
            onClick={openCommandPalette}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          {user && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Workflow className="h-4 w-4 text-primary" />
              </div>
              ProjectStatus
            </SheetTitle>
            <SheetDescription>Navigate the app</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 mt-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-3.5 py-2.5 rounded-lg text-sm transition-colors",
                  isActive(l.href) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
