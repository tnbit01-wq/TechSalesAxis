import { Metadata } from 'next';
import AdminSidebar from '@/components/AdminSidebar';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Techsales Axis',
  description: 'Techsales Axis Administration',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 overscroll-none overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8">
            {children}
        </div>
      </main>
    </div>
  );
}
