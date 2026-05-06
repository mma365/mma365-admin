'use client';

import { useState } from 'react';

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: `Envoyé à ${data.sent} destinataires.` });
        setTitle('');
        setBody('');
      } else {
        setResult({ error: data.error ?? 'Erreur inconnue' });
      }
    } catch {
      setResult({ error: 'Erreur réseau' });
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Notifications globales</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg">
        <form onSubmit={handleSend} className="flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Nouvelle mise à jour"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Contenu de la notification..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 resize-none"
              required
            />
          </div>
          {result?.success && <p className="text-green-400 text-sm">{result.success}</p>}
          {result?.error && <p className="text-red-400 text-sm">{result.error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Envoi en cours...' : 'Envoyer à tous les utilisateurs'}
          </button>
        </form>
      </div>
    </div>
  );
}
