import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 pt-20 md:px-8 md:pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </main>
    </div>
  );
}
