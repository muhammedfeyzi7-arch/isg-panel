import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import DoctorTopbar from '@/components/feature/DoctorTopbar';
import DoctorMobileBottomNav from '@/components/feature/DoctorMobileBottomNav';
import ToastContainer from '@/components/base/ToastContainer';

export default function DoctorLayout() {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const handleToggleDark = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <DoctorTopbar darkMode={darkMode} onToggleDark={handleToggleDark} />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <DoctorMobileBottomNav />
      <ToastContainer />
    </div>
  );
}
