'use client';

import { useState } from 'react';

export function BumpCacheButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleClick() {
    setState('loading');
    try {
      const res = await fetch('/api/bump-cache', { method: 'POST' });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 3000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm mb-3">
        Force le rechargement des données sur tous les appareils (events, fighters, rankings).
      </p>
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
      >
        {state === 'loading' && 'En cours...'}
        {state === 'done' && '✓ Cache invalidé'}
        {state === 'error' && '✗ Erreur'}
        {state === 'idle' && 'Invalider le cache app'}
      </button>
    </div>
  );
}
