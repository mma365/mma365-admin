'use client';

import { useState, useEffect, useCallback } from 'react';

type Org = {
  id: string;
  name: string;
  short_name: string | null;
  tier: 'major' | 'regional';
  region: string | null;
  country: string | null;
  accent_dark: string;
  accent_light: string;
  has_rankings: boolean;
  is_active: boolean;
  display_order: number;
};

type NotifState = {
  title: string;
  body: string;
  titleEn: string;
  bodyEn: string;
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  // Modal "Activer + Notifier"
  const [activateOrg, setActivateOrg] = useState<Org | null>(null);
  const [notif, setNotif] = useState<NotifState>({ title: '', body: '', titleEn: '', bodyEn: '' });
  const [notifSending, setNotifSending] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);

  // Modal "Éditer"
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editForm, setEditForm] = useState<Partial<Org>>({});
  const [editSaving, setEditSaving] = useState(false);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/organizations');
    const data = await res.json();
    setOrgs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  async function activate(org: Org) {
    setActivating(org.id);
    await fetch(`/api/organizations?id=${encodeURIComponent(org.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    await loadOrgs();
    setActivating(null);
    // Pré-remplir la notif
    const display = org.short_name ?? org.name;
    setNotif({
      title: `${org.name} est disponible sur MMA365`,
      body: `Retrouve les événements ${display} dans ton fil d'actu.`,
      titleEn: `${display} is now available on MMA365`,
      bodyEn: `Follow ${display} events in your feed.`,
    });
    setNotifResult(null);
    setActivateOrg(org);
  }

  async function sendNotif() {
    if (!activateOrg) return;
    setNotifSending(true);
    setNotifResult(null);
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: notif.title,
        body: notif.body,
        titleEn: notif.titleEn || undefined,
        bodyEn: notif.bodyEn || undefined,
      }),
    });
    const data = await res.json();
    setNotifResult(data.sent != null ? `✅ Notification envoyée à ${data.sent} appareils` : `❌ ${data.error}`);
    setNotifSending(false);
  }

  function openEdit(org: Org) {
    setEditOrg(org);
    setEditForm({
      short_name: org.short_name,
      accent_dark: org.accent_dark,
      accent_light: org.accent_light,
      tier: org.tier,
      region: org.region,
      country: org.country,
      display_order: org.display_order,
      has_rankings: org.has_rankings,
    });
  }

  async function saveEdit() {
    if (!editOrg) return;
    setEditSaving(true);
    await fetch(`/api/organizations?id=${encodeURIComponent(editOrg.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    await loadOrgs();
    setEditSaving(false);
    setEditOrg(null);
  }

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">Organisations</h1>

      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="pb-3 pr-4 font-medium">•</th>
                <th className="pb-3 pr-4 font-medium">Nom complet</th>
                <th className="pb-3 pr-4 font-medium">Alias</th>
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Région</th>
                <th className="pb-3 pr-4 font-medium">Actif</th>
                <th className="pb-3 pr-4 font-medium">Ordre</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-b border-gray-800/50">
                  <td className="py-3 pr-4">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: org.accent_dark }}
                    />
                  </td>
                  <td className="py-3 pr-4 text-white font-medium">{org.name}</td>
                  <td className="py-3 pr-4 text-gray-300">{org.short_name ?? <span className="text-gray-600">—</span>}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${org.tier === 'major' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-300'}`}>
                      {org.tier}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{org.region ?? '—'}</td>
                  <td className="py-3 pr-4">
                    {org.is_active ? (
                      <span className="text-green-400">✓ Actif</span>
                    ) : (
                      <button
                        onClick={() => activate(org)}
                        disabled={activating === org.id}
                        className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
                      >
                        {activating === org.id ? '...' : 'Activer'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{org.display_order}</td>
                  <td className="py-3">
                    <button
                      onClick={() => openEdit(org)}
                      className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 rounded-lg transition-colors"
                    >
                      Éditer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Activer + Notifier */}
      {activateOrg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white text-lg font-bold mb-1">
              {activateOrg.name} activé ✓
            </h2>
            <p className="text-gray-400 text-sm mb-5">Notifier les utilisateurs de l&apos;arrivée de cette organisation ?</p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Titre FR</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={notif.title}
                  onChange={(e) => setNotif((n) => ({ ...n, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Corps FR</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={notif.body}
                  onChange={(e) => setNotif((n) => ({ ...n, body: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Titre EN</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={notif.titleEn}
                  onChange={(e) => setNotif((n) => ({ ...n, titleEn: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Corps EN</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={notif.bodyEn}
                  onChange={(e) => setNotif((n) => ({ ...n, bodyEn: e.target.value }))}
                />
              </div>
            </div>

            {notifResult && (
              <p className="text-sm mb-4 text-gray-300">{notifResult}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setActivateOrg(null)}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Fermer sans notifier
              </button>
              <button
                onClick={sendNotif}
                disabled={notifSending || !notif.title || !notif.body}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {notifSending ? 'Envoi...' : 'Envoyer la notification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Éditer */}
      {editOrg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white text-lg font-bold mb-5">Éditer — {editOrg.name}</h2>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Alias (shortName)</label>
                <input
                  placeholder="ex: CWFC (vide = nom complet)"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={editForm.short_name ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, short_name: e.target.value || null }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Tier</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={editForm.tier}
                  onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value as 'major' | 'regional' }))}
                >
                  <option value="major">major</option>
                  <option value="regional">regional</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Région</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={editForm.region ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value || null }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Pays</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={editForm.country ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value || null }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Couleur dark</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
                    value={editForm.accent_dark ?? '#888888'}
                    onChange={(e) => setEditForm((f) => ({ ...f, accent_dark: e.target.value }))}
                  />
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                    value={editForm.accent_dark ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, accent_dark: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Couleur light</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
                    value={editForm.accent_light ?? '#888888'}
                    onChange={(e) => setEditForm((f) => ({ ...f, accent_light: e.target.value }))}
                  />
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                    value={editForm.accent_light ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, accent_light: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Ordre d&apos;affichage</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                  value={editForm.display_order ?? 100}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <label className="text-gray-400 text-sm">Has Rankings</label>
                <button
                  onClick={() => setEditForm((f) => ({ ...f, has_rankings: !f.has_rankings }))}
                  className={`w-10 h-6 rounded-full transition-colors ${editForm.has_rankings ? 'bg-red-600' : 'bg-gray-700'}`}
                >
                  <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-1 ${editForm.has_rankings ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditOrg(null)}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
