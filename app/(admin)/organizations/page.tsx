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

type Step = {
  number: number;
  title: string;
  tag: string;
  description: string;
  code?: string;
  warning?: string;
  checklist?: string[];
};

const PROCESS_STEPS: Step[] = [
  {
    number: 1,
    title: 'Collecter les prérequis',
    tag: 'AVANT TOUT',
    description: 'Réunir toutes les infos avant de toucher au code ou à la DB.',
    checklist: [
      'name — nom complet affiché dans MyOrgsScreen (ex : "Cage Warriors")',
      'shortName — alias court pour chips/onglets (ex : "CWFC"), laisser NULL si identique au name',
      'Sherdog ID — aller sur sherdog.com/organizations, trouver l\'org, copier le slug dans l\'URL (ex : "Cage-Warriors-186")',
      'tier — "major" ou "regional"',
      'region — "International", "Europe", "Asie", "Amériques"…',
      'country — pays (affiché en sous-texte dans MyOrgsScreen)',
      'accent_dark / accent_light — deux couleurs hex (dark = fond foncé, light = variante claire)',
      'weight_classes — divisions scrappées (Heavyweight, Lightweight…)',
      'hasRankings — false par défaut ; true seulement si un scraper rankings est prêt',
    ],
  },
  {
    number: 2,
    title: 'Insérer en DB (is_active=false)',
    tag: 'SQL',
    description: 'Exécuter ce SQL dans le dashboard Supabase. Le is_active=false est obligatoire — l\'org sera invisible dans l\'app jusqu\'à activation explicite.',
    code: `INSERT INTO organizations
  (id, name, short_name, tier, region, country,
   accent_dark, accent_light, has_rankings, weight_classes, is_active, display_order)
VALUES (
  'MonOrg', 'Mon Organisation', 'ALIAS',
  'regional', 'Europe', 'Pays',
  '#COULEUR1', '#COULEUR2',
  false,
  ARRAY['Heavyweight','Light Heavyweight','Middleweight',
        'Welterweight','Lightweight','Featherweight',
        'Bantamweight','Flyweight'],
  false,   -- ← NE PAS METTRE true ICI
  99
) ON CONFLICT (id) DO UPDATE SET
  accent_dark   = EXCLUDED.accent_dark,
  accent_light  = EXCLUDED.accent_light,
  short_name    = EXCLUDED.short_name,
  display_order = EXCLUDED.display_order;`,
    warning: 'is_active=false est invariable au moment du INSERT. L\'activation se fait uniquement via cette page admin une fois le scraping validé.',
  },
  {
    number: 3,
    title: 'Trouver l\'heure officielle des events',
    tag: 'HEURE',
    description: 'Sherdog ne donne pas les horaires. Pour afficher "CE SOIR 22h00" dans l\'app, il faut scraper le site officiel de l\'org ou une source tierce (Tapology, site de l\'org).',
    checklist: [
      'Vérifier si l\'org a un site officiel avec les horaires (ex: ufcfightpass.com, onefc.com, ksw.tv)',
      'Vérifier si Tapology liste les horaires pour cette org : tapology.com/fightcenter',
      'Si horaire disponible → ajouter un scraper dédié dans sync_event_times.py (ou équivalent) qui renseigne main_card_time_utc en UTC',
      'Si pas de source fiable → laisser main_card_time_utc NULL : l\'app affichera la date sans heure',
      'Format attendu en DB : "2026-06-20T20:00:00" (UTC, sans timezone)',
    ],
    warning: 'main_card_time_utc NULL n\'est pas bloquant — l\'event s\'affichera avec la date uniquement. Ne pas bloquer l\'ajout d\'une org sur ce point.',
  },
  {
    number: 4,
    title: 'Ajouter au scraper Sherdog',
    tag: 'SCRAPER',
    description: 'Dans mma-scrapers/scrape_sherdog.py, ajouter l\'entrée dans le dict SHERDOG_ORGS (lignes ~49-57).',
    code: `# scrape_sherdog.py — dict SHERDOG_ORGS
"Mon Organisation": {"id": "Slug-Sherdog-123", "label": "Mon Organisation"},`,
  },
  {
    number: 5,
    title: 'Valider avec un dry-run',
    tag: 'TEST',
    description: 'Lancer en local pour vérifier que les events sont détectés avec les bonnes dates. Ne pas continuer si le dry-run retourne 0 events.',
    code: `python sync_events.py --orgs "Mon Organisation" --dry-run

# Vérifier dans la sortie :
# ✓ Nombre d'events > 0
# ✓ Dates cohérentes (pas de dates dans le futur lointain ni le passé excessif)
# ✓ Pas d'erreur HTTP / scraping`,
  },
  {
    number: 6,
    title: 'Lancer le sync réel',
    tag: 'SYNC',
    description: 'Une fois le dry-run validé, insérer les events et les fights en DB.',
    code: `python sync_events.py --orgs "Mon Organisation"

# Les events sont maintenant en DB (organization = 'Mon Organisation')
# Vérifiable dans Supabase : SELECT * FROM events WHERE organization = 'Mon Organisation'`,
  },
  {
    number: 7,
    title: 'Ajouter au workflow GitHub Actions',
    tag: 'CI',
    description: 'Dans mma-scrapers/.github/workflows/daily.yml, ajouter l\'org aux 4 steps (sync_events, sync_fighters, sync_history, sync_results).',
    code: `# Avant
run: python sync_events.py --orgs UFC ONE PFL KSW "Cage Warriors"

# Après
run: python sync_events.py --orgs UFC ONE PFL KSW "Cage Warriors" "Mon Organisation"

# ⚠️ Répéter pour les 4 steps : sync_events, sync_fighters, sync_history, sync_results`,
    warning: 'Ne modifier le workflow qu\'après validation du dry-run en local. Commit + push déclenchera le daily automatiquement.',
  },
  {
    number: 8,
    title: 'Activer ici + Notifier',
    tag: 'ADMIN',
    description: 'Retourner dans l\'onglet "Liste", cliquer sur "Activer" pour l\'org concernée. L\'org devient immédiatement visible dans MyOrgsScreen pour tous les utilisateurs v1.1+. Un modal s\'ouvre pour envoyer la notification push bilingue.',
    warning: 'Envoyer la notification uniquement si la version de l\'app qui supporte cette org est déjà live sur les stores. Sinon les utilisateurs voient la notif mais rien dans l\'app.',
  },
  {
    number: 9,
    title: 'Checklist visuelle sur l\'app',
    tag: 'TEST',
    description: 'Vérifier chaque point sur un device (ou simulateur) après activation.',
    checklist: [
      'MyOrgsScreen → org visible dans la bonne section (MAJEURES ou région)',
      'MyOrgsScreen → nom complet affiché, dot de la bonne couleur dark + light',
      'Home → suivre l\'org → chip [shortName] apparaît en haut',
      'Home → events de la nouvelle org dans le fil d\'actu',
      'Home → désuivre → chip disparaît, events masqués',
      'FightersScreen → onglet [shortName] avec bonne couleur accent, filtrable par division',
      'RankingsScreen → onglet [shortName] → "Aucun classement disponible" (si hasRankings=false)',
      'Notification reçue sur device test (FR + EN)',
      'Boot hors-ligne → org toujours visible via STATIC_FALLBACK_ORGS',
    ],
  },
];

const TAG_COLORS: Record<string, string> = {
  'AVANT TOUT': 'bg-purple-500/20 text-purple-400',
  SQL:          'bg-blue-500/20 text-blue-400',
  HEURE:        'bg-indigo-500/20 text-indigo-400',
  SCRAPER:      'bg-yellow-500/20 text-yellow-400',
  TEST:         'bg-green-500/20 text-green-400',
  SYNC:         'bg-cyan-500/20 text-cyan-400',
  CI:           'bg-orange-500/20 text-orange-400',
  ADMIN:        'bg-red-500/20 text-red-400',
};

export default function OrganizationsPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'guide'>('list');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const [activateOrg, setActivateOrg] = useState<Org | null>(null);
  const [notif, setNotif] = useState<NotifState>({ title: '', body: '', titleEn: '', bodyEn: '' });
  const [notifSending, setNotifSending] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);

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
      {/* Header + Tabs */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Organisations</h1>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'guide' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Guide d&apos;ajout
          </button>
        </div>
      </div>

      {/* ── Tab : Liste ─────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        loading ? (
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
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: org.accent_dark }} />
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
        )
      )}

      {/* ── Tab : Guide d'ajout ─────────────────────────────────────────────── */}
      {activeTab === 'guide' && (
        <div className="max-w-3xl">
          <p className="text-gray-400 text-sm mb-8">
            Suivre ces étapes dans l&apos;ordre pour ajouter une organisation sans nouveau build de l&apos;app.
            À partir de la v1.1, seuls la DB et le scraper sont nécessaires.
          </p>

          <div className="space-y-6">
            {PROCESS_STEPS.map((step) => (
              <div key={step.number} className="flex gap-4">
                {/* Numéro */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                  {step.number}
                </div>

                {/* Contenu */}
                <div className="flex-1 pb-6 border-b border-gray-800/60">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-semibold">{step.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[step.tag] ?? 'bg-gray-700 text-gray-300'}`}>
                      {step.tag}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-3">{step.description}</p>

                  {step.checklist && (
                    <ul className="space-y-1.5 mb-3">
                      {step.checklist.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="text-gray-600 mt-0.5">□</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {step.code && (
                    <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {step.code}
                    </pre>
                  )}

                  {step.warning && (
                    <div className="mt-3 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                      <span className="text-yellow-400 text-xs mt-0.5">⚠</span>
                      <p className="text-yellow-300 text-xs">{step.warning}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <p className="text-white font-semibold mb-1">Règle d&apos;or</p>
            <p className="text-gray-400 text-sm">
              <span className="text-white">is_active=false au INSERT</span> — toujours. L&apos;activation via cette page est l&apos;unique déclencheur de visibilité dans l&apos;app.
              Cela permet de préparer une org en avance (scraping, validation) sans impacter les utilisateurs.
            </p>
          </div>
        </div>
      )}

      {/* Modal Activer + Notifier */}
      {activateOrg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white text-lg font-bold mb-1">{activateOrg.name} activé ✓</h2>
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

            {notifResult && <p className="text-sm mb-4 text-gray-300">{notifResult}</p>}

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
