'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FighterRow = Record<string, unknown> & {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  organization: string;
  weight_class: string;
  country: string;
  wins: number;
  losses: number;
  draws: number;
  no_contests: number;
  date_of_birth: string | null;
  height: string | null;
  reach: string | null;
  stance: string | null;
  image_uri: string | null;
};

export default function FighterEditForm({ fighter }: { fighter: FighterRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    first_name: fighter.first_name ?? '',
    last_name: fighter.last_name ?? '',
    nickname: fighter.nickname ?? '',
    organization: fighter.organization ?? '',
    weight_class: fighter.weight_class ?? '',
    country: fighter.country ?? '',
    wins: String(fighter.wins ?? 0),
    losses: String(fighter.losses ?? 0),
    draws: String(fighter.draws ?? 0),
    no_contests: String(fighter.no_contests ?? 0),
    date_of_birth: fighter.date_of_birth ?? '',
    height: fighter.height ?? '',
    reach: fighter.reach ?? '',
    stance: fighter.stance ?? '',
    image_uri: fighter.image_uri ?? '',
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const res = await fetch(`/api/fighters/${fighter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name,
        nickname: form.nickname || null,
        organization: form.organization,
        weight_class: form.weight_class,
        country: form.country,
        wins: Number(form.wins),
        losses: Number(form.losses),
        draws: Number(form.draws),
        no_contests: Number(form.no_contests),
        date_of_birth: form.date_of_birth || null,
        height: form.height || null,
        reach: form.reach || null,
        stance: form.stance || null,
        image_uri: form.image_uri || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Erreur');
    } else {
      setSuccess('Sauvegardé.');
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce fighter ? Cette action est irréversible.')) return;
    setDeleting(true);
    await fetch(`/api/fighters/${fighter.id}`, { method: 'DELETE' });
    router.push('/fighters');
  }

  function field(key: keyof typeof form, label: string, type = 'text') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-gray-400 text-xs">{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">
          {fighter.first_name} {fighter.last_name}
        </h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-400 text-sm border border-red-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {field('first_name', 'Prénom')}
          {field('last_name', 'Nom')}
        </div>
        {field('nickname', 'Surnom')}
        <div className="grid grid-cols-2 gap-4">
          {field('organization', 'Organisation')}
          {field('weight_class', 'Division')}
        </div>
        {field('country', 'Pays')}
        <div className="grid grid-cols-4 gap-3">
          {field('wins', 'Victoires', 'number')}
          {field('losses', 'Défaites', 'number')}
          {field('draws', 'Nuls', 'number')}
          {field('no_contests', 'NC', 'number')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('date_of_birth', 'Date de naissance', 'date')}
          {field('stance', 'Stance')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('height', 'Taille')}
          {field('reach', 'Allonge')}
        </div>
        {field('image_uri', 'Image URL')}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </form>
    </div>
  );
}
