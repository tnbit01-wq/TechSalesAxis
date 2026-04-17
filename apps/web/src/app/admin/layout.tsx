import { Metadata } from 'next';
import AdminSidebar from '@/components/AdminSidebar';
import { SidebarProvider } from '@/context/SidebarContext';
import AdminLayoutClient from '@/components/AdminLayoutClient';

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
    <SidebarProvider>
      <div className="flex h-screen bg-slate-50 overscroll-none overflow-hidden">
        <AdminSidebar />
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </div>
    </SidebarProvider>
  );
}
