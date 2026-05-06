'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewFighterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    organization: '',
    weight_class: '',
    country: '',
    wins: '0',
    losses: '0',
    draws: '0',
    no_contests: '0',
    date_of_birth: '',
    height: '',
    reach: '',
    stance: '',
    image_uri: '',
  });

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.organization) {
      setError('Prénom, nom et organisation sont requis.');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: err } = await supabase
      .from('fighters')
      .insert({
        first_name: form.first_name,
        last_name: form.last_name,
        nickname: form.nickname || null,
        organization: form.organization,
        weight_class: form.weight_class || null,
        country: form.country || null,
        wins: Number(form.wins),
        losses: Number(form.losses),
        draws: Number(form.draws),
        no_contests: Number(form.no_contests),
        date_of_birth: form.date_of_birth || null,
        height: form.height || null,
        reach: form.reach || null,
        stance: form.stance || null,
        image_uri: form.image_uri || null,
      })
      .select('id')
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
    } else if (data) {
      router.push(`/fighters/${data.id}`);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-6">Nouveau fighter</h1>

      <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {field('first_name', 'Prénom *')}
          {field('last_name', 'Nom *')}
        </div>
        {field('nickname', 'Surnom')}
        <div className="grid grid-cols-2 gap-4">
          {field('organization', 'Organisation *')}
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

        <button
          type="submit"
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
        >
          {saving ? 'Création...' : 'Créer'}
        </button>
      </form>
    </div>
  );
}
