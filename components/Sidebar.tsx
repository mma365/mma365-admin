'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const links = [
  { href: '/', label: 'Dashboard', icon: '⚡' },
  { href: '/events', label: 'Events', icon: '📅' },
  { href: '/fighters', label: 'Fighters', icon: '🥊' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col h-screen fixed left-0 top-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-white font-bold text-lg">MMA365</span>
        <span className="text-gray-500 text-xs ml-2">Admin</span>
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-red-600/20 text-red-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span>→</span> Déconnexion
        </button>
      </div>
    </aside>
  );
}
