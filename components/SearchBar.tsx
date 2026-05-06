'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useRef } from 'react';

export default function SearchBar({ defaultValue = '', placeholder = 'Rechercher...' }: { defaultValue?: string; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    clearTimeout(timer.current);
    const q = e.target.value;
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set('q', q);
      else params.delete('q');
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
  }

  return (
    <input
      type="search"
      defaultValue={defaultValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-red-500 w-64 placeholder-gray-500"
    />
  );
}
