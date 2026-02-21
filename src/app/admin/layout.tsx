"use client";
import { AdminGate } from "@/components/admin-gate";
import { AdminNavbar } from "@/components/admin-navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-[100dvh] flex flex-col">
        <AdminNavbar />
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </AdminGate>
  );
}
