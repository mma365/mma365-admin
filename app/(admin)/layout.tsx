import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
