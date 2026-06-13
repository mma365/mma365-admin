'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Org = {
  id: string; name: string; short_name: string | null;
  tier: 'major' | 'regional'; region: string | null; country: string | null;
  accent_dark: string; accent_light: string; has_rankings: boolean;
  is_active: boolean; display_order: number;
};

type WizardForm = {
  id: string; name: string; shortName: string; sherdogId: string;
  tier: 'major' | 'regional'; region: string; country: string;
  accentDark: string; accentLight: string; hasRankings: boolean;
  weightClasses: string[]; displayOrder: number;
};

type NotifState = { title: string; body: string; titleEn: string; bodyEn: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHT_CLASSES = [
  'Heavyweight', 'Light Heavyweight', 'Middleweight', 'Welterweight',
  'Lightweight', 'Featherweight', 'Bantamweight', 'Flyweight',
  'Strawweight', 'Atomweight',
  "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight",
  "Women's Featherweight", "Women's Lightweight",
  "Men's Pound for Pound", "Women's Pound for Pound",
];

const DEFAULT_WC = [
  'Heavyweight', 'Light Heavyweight', 'Middleweight', 'Welterweight',
  'Lightweight', 'Featherweight', 'Bantamweight', 'Flyweight',
];

const INIT_FORM: WizardForm = {
  id: '', name: '', shortName: '', sherdogId: '',
  tier: 'regional', region: 'Europe', country: '',
  accentDark: '#CC0000', accentLight: '#AA0000',
  hasRankings: false, weightClasses: DEFAULT_WC, displayOrder: 99,
};

const STEPS = ['Infos', 'DB', 'Heure', 'Scraper', 'Dry-run', 'Sync', 'CI', 'Activer'];

// ── Snippet generators ────────────────────────────────────────────────────────

const snip = {
  scraper: (f: WizardForm) =>
    `# scrape_sherdog.py — dict SHERDOG_ORGS (~ligne 50)\n"${f.name}": {"id": "${f.sherdogId || 'SLUG-SHERDOG-XXX'}", "label": "${f.name}"},`,

  dryRun: (f: WizardForm) =>
    `python sync_events.py --orgs "${f.name}" --dry-run\n\n# Vérifier : events > 0, dates cohérentes, aucune erreur HTTP`,

  sync: (f: WizardForm) =>
    `python sync_events.py --orgs "${f.name}"\npython sync_fighters.py --orgs "${f.name}"`,

  ci: (f: WizardForm) =>
    `# .github/workflows/daily.yml — 4 steps à modifier\nrun: python sync_events.py   --orgs UFC ONE PFL KSW "Cage Warriors" "${f.name}"\nrun: python sync_fighters.py --orgs UFC ONE PFL KSW "Cage Warriors" "${f.name}"\nrun: python sync_history.py  --orgs UFC ONE PFL KSW "Cage Warriors" "${f.name}"\nrun: python sync_results.py  --orgs UFC ONE PFL KSW "Cage Warriors" "${f.name}"`,

  fallback: (f: WizardForm) => {
    const id = f.id || f.name;
    const wcs = f.weightClasses.map(w => `'${w}'`).join(', ');
    return `// src/constants/organizations.ts — STATIC_FALLBACK_ORGS\n{\n  id: '${id}',\n  name: '${f.name}',${f.shortName ? `\n  shortName: '${f.shortName}',` : ''}\n  tier: '${f.tier}',\n  region: '${f.region}',\n  country: '${f.country}',\n  hasRankings: ${f.hasRankings},\n  accentColor: { dark: '${f.accentDark}', light: '${f.accentLight}' },\n  weightClasses: [${wcs}],\n  isActive: true,\n  displayOrder: ${f.displayOrder},\n},`;
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? '✓ Copié' : 'Copier'}
      </button>
    </div>
  );
}

function ConfirmBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer mt-5 p-3 rounded-lg border border-dashed border-gray-700 hover:border-gray-500 transition-colors">
      <div
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${checked ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}
      >
        {checked && <span className="text-white text-xs font-bold">✓</span>}
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500';
const selectCls = inputCls;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  // ─ Shared
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  // ─ List state
  const [activating, setActivating] = useState<string | null>(null);
  const [activateOrg, setActivateOrg] = useState<Org | null>(null);
  const [notif, setNotif] = useState<NotifState>({ title: '', body: '', titleEn: '', bodyEn: '' });
  const [notifSending, setNotifSending] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editForm, setEditForm] = useState<Partial<Org>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ─ Wizard state
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>({ ...INIT_FORM });
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [dbLoading, setDbLoading] = useState(false);
  const [dbResult, setDbResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [wizActivated, setWizActivated] = useState(false);
  const [wizActivating, setWizActivating] = useState(false);
  const [wizNotif, setWizNotif] = useState<NotifState>({ title: '', body: '', titleEn: '', bodyEn: '' });
  const [wizNotifSending, setWizNotifSending] = useState(false);
  const [wizNotifResult, setWizNotifResult] = useState<string | null>(null);

  // ─ Load
  const loadOrgs = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/organizations');
    const data = await res.json();
    setOrgs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);
  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  // ─ Sync id → name (when name changes and id was auto)
  function setName(name: string) {
    setForm(f => ({ ...f, name, id: f.id === f.name ? name : f.id }));
  }

  // ─ List actions
  async function activate(org: Org) {
    setActivating(org.id);
    await fetch(`/api/organizations?id=${encodeURIComponent(org.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    await loadOrgs();
    setActivating(null);
    const display = org.short_name ?? org.name;
    setNotif({ title: `${org.name} est disponible sur MMA365`, body: `Retrouve les événements ${display} dans ton fil d'actu.`, titleEn: `${display} is now available on MMA365`, bodyEn: `Follow ${display} events in your feed.` });
    setNotifResult(null);
    setActivateOrg(org);
  }

  async function sendNotif() {
    if (!activateOrg) return;
    setNotifSending(true); setNotifResult(null);
    const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: notif.title, body: notif.body, titleEn: notif.titleEn || undefined, bodyEn: notif.bodyEn || undefined }) });
    const data = await res.json();
    setNotifResult(data.sent != null ? `✅ ${data.sent} appareils notifiés` : `❌ ${data.error}`);
    setNotifSending(false);
  }

  function openEdit(org: Org) {
    setEditOrg(org);
    setEditForm({ short_name: org.short_name, accent_dark: org.accent_dark, accent_light: org.accent_light, tier: org.tier, region: org.region, country: org.country, display_order: org.display_order, has_rankings: org.has_rankings });
  }

  async function saveEdit() {
    if (!editOrg) return;
    setEditSaving(true);
    await fetch(`/api/organizations?id=${encodeURIComponent(editOrg.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
    await loadOrgs(); setEditSaving(false); setEditOrg(null);
  }

  // ─ Wizard actions
  function resetWizard() { setStep(1); setForm({ ...INIT_FORM }); setConfirmed({}); setDbResult(null); setWizActivated(false); setWizNotifResult(null); }

  async function insertToDB() {
    setDbLoading(true); setDbResult(null);
    const res = await fetch('/api/organizations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: form.id || form.name, name: form.name, short_name: form.shortName || null, tier: form.tier, region: form.region || null, country: form.country || null, accent_dark: form.accentDark, accent_light: form.accentLight, has_rankings: form.hasRankings, weight_classes: form.weightClasses, display_order: form.displayOrder }),
    });
    const data = await res.json();
    if (data.ok) { await loadOrgs(); setDbResult({ ok: true }); setTimeout(() => setStep(3), 600); }
    else setDbResult({ ok: false, error: data.error });
    setDbLoading(false);
  }

  async function activateInWizard() {
    setWizActivating(true);
    await fetch(`/api/organizations?id=${encodeURIComponent(form.id || form.name)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) });
    await loadOrgs();
    setWizActivated(true); setWizActivating(false);
    const display = form.shortName || form.name;
    setWizNotif({ title: `${form.name} est disponible sur MMA365`, body: `Retrouve les événements ${display} dans ton fil d'actu.`, titleEn: `${display} is now available on MMA365`, bodyEn: `Follow ${display} events in your feed.` });
  }

  async function sendWizNotif() {
    setWizNotifSending(true); setWizNotifResult(null);
    const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: wizNotif.title, body: wizNotif.body, titleEn: wizNotif.titleEn || undefined, bodyEn: wizNotif.bodyEn || undefined }) });
    const data = await res.json();
    setWizNotifResult(data.sent != null ? `✅ ${data.sent} appareils notifiés` : `❌ ${data.error}`);
    setWizNotifSending(false);
  }

  function setConfirm(n: number, v: boolean) { setConfirmed(c => ({ ...c, [n]: v })); }
  function toggleWC(wc: string) { setForm(f => ({ ...f, weightClasses: f.weightClasses.includes(wc) ? f.weightClasses.filter(w => w !== wc) : [...f.weightClasses, wc] })); }

  function canNext(): boolean {
    if (step === 1) return !!form.name.trim();
    if (step === 2) return dbResult?.ok === true;
    if (step === 3) return confirmed[3] === true;
    if (step === 4) return !!form.sherdogId.trim() && confirmed[4] === true;
    if (step === 5) return confirmed[5] === true;
    if (step === 6) return confirmed[6] === true;
    if (step === 7) return confirmed[7] === true;
    return false;
  }

  // ─ Wizard step content
  function renderWizardStep() {
    switch (step) {

      case 1: return (
        <div className="space-y-5">
          <p className="text-gray-400 text-sm">Renseigne toutes les informations de la nouvelle organisation. Tu pourras les modifier après depuis la liste.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Nom complet *" hint="Affiché dans MyOrgsScreen">
                <input className={inputCls} value={form.name} onChange={e => setName(e.target.value)} placeholder="ex: Cage Warriors" />
              </Field>
            </div>
            <Field label="ID (clé DB)" hint="Doit correspondre à events.organization — auto-rempli avec le nom">
              <input className={inputCls} value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} placeholder={form.name || 'ex: Cage Warriors'} />
            </Field>
            <Field label="Alias / shortName" hint="Chips + onglets. Vide = nom complet">
              <input className={inputCls} value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))} placeholder="ex: CWFC" />
            </Field>
            <Field label="Sherdog ID" hint="Slug dans l'URL sherdog.com/organizations/...">
              <input className={inputCls} value={form.sherdogId} onChange={e => setForm(f => ({ ...f, sherdogId: e.target.value }))} placeholder="ex: Cage-Warriors-186" />
            </Field>
            <Field label="Tier">
              <select className={selectCls} value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value as 'major' | 'regional' }))}>
                <option value="regional">regional</option>
                <option value="major">major</option>
              </select>
            </Field>
            <Field label="Région">
              <input className={inputCls} value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="ex: Europe" />
            </Field>
            <Field label="Pays">
              <input className={inputCls} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="ex: Royaume-Uni" />
            </Field>
            <Field label="Ordre d'affichage">
              <input type="number" className={inputCls} value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: Number(e.target.value) }))} />
            </Field>
            <div>
              <Field label="Couleur dark">
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" value={form.accentDark} onChange={e => setForm(f => ({ ...f, accentDark: e.target.value }))} />
                  <input className={inputCls} value={form.accentDark} onChange={e => setForm(f => ({ ...f, accentDark: e.target.value }))} />
                </div>
              </Field>
            </div>
            <div>
              <Field label="Couleur light">
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" value={form.accentLight} onChange={e => setForm(f => ({ ...f, accentLight: e.target.value }))} />
                  <input className={inputCls} value={form.accentLight} onChange={e => setForm(f => ({ ...f, accentLight: e.target.value }))} />
                </div>
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-sm">Has Rankings</label>
            <button onClick={() => setForm(f => ({ ...f, hasRankings: !f.hasRankings }))} className={`w-10 h-6 rounded-full transition-colors ${form.hasRankings ? 'bg-red-600' : 'bg-gray-700'}`}>
              <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-1 ${form.hasRankings ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-xs text-gray-500">false par défaut — activer uniquement si un scraper rankings est prêt</span>
          </div>

          <Field label="Divisions">
            <div className="flex flex-wrap gap-2 mt-2">
              {WEIGHT_CLASSES.map(wc => (
                <button key={wc} onClick={() => toggleWC(wc)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.weightClasses.includes(wc) ? 'bg-red-600 border-red-600 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}>
                  {wc}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">{form.weightClasses.length} division(s) sélectionnée(s)</p>
          </Field>

          {/* Preview */}
          <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center gap-3">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: form.accentDark }} />
            <div>
              <span className="text-white text-sm font-medium">{form.name || '—'}</span>
              {form.shortName && <span className="text-gray-400 text-xs ml-2">({form.shortName})</span>}
              <span className="text-gray-500 text-xs ml-2">· {form.tier} · {form.region}</span>
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">L&apos;organisation sera insérée en DB avec <span className="text-white">is_active=false</span> — invisible dans l&apos;app jusqu&apos;à l&apos;étape 8.</p>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
            {[
              ['ID', form.id || form.name],
              ['Nom', form.name],
              ['Alias', form.shortName || '—'],
              ['Tier', form.tier],
              ['Région / Pays', `${form.region} / ${form.country}`],
              ['Ordre', String(form.displayOrder)],
              ['Divisions', `${form.weightClasses.length} classe(s)`],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="text-gray-500 w-28 flex-shrink-0">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
            <div className="flex gap-3 items-center">
              <span className="text-gray-500 w-28">Couleurs</span>
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: form.accentDark }} />
              <span className="text-white text-xs">{form.accentDark}</span>
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: form.accentLight }} />
              <span className="text-white text-xs">{form.accentLight}</span>
            </div>
          </div>

          {!dbResult && (
            <button onClick={insertToDB} disabled={dbLoading} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors">
              {dbLoading ? 'Insertion...' : 'Insérer en base de données →'}
            </button>
          )}
          {dbResult?.ok && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-green-400 text-lg">✓</span>
              <span className="text-green-300 text-sm font-medium">{form.name} ajouté en DB (is_active=false)</span>
            </div>
          )}
          {dbResult && !dbResult.ok && (
            <div className="space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">{dbResult.error}</div>
              <button onClick={insertToDB} disabled={dbLoading} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm">
                Réessayer
              </button>
            </div>
          )}
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Sherdog ne fournit pas les horaires. Pour afficher &quot;CE SOIR 22h00&quot;, il faut renseigner <span className="text-white">main_card_time_utc</span> en DB.</p>
          <div className="space-y-2">
            {[
              'Vérifier le site officiel de l\'org (ex: ksw.tv, onefc.com, ufcfightpass.com)',
              'Vérifier Tapology : tapology.com/fightcenter → liste souvent les horaires',
              'Si source trouvée → ajouter scraping dans sync_event_times.py pour cette org',
              'Si aucune source fiable → laisser NULL : l\'app affiche la date sans heure (non bloquant)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="text-gray-600 mt-0.5 flex-shrink-0">□</span>
                {item}
              </div>
            ))}
          </div>
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 text-xs">
            ⚠ Format DB attendu : &quot;2026-06-20T20:00:00&quot; (UTC, sans timezone). Ne pas bloquer l&apos;ajout d&apos;une org sur ce point.
          </div>
          <ConfirmBox label="J'ai vérifié les sources d'horaires pour cette org" checked={!!confirmed[3]} onChange={v => setConfirm(3, v)} />
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Ajouter l&apos;entrée dans <span className="text-white">mma-scrapers/scrape_sherdog.py</span>, dict <span className="text-white">SHERDOG_ORGS</span>.</p>
          {!form.sherdogId && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 text-xs">
              ⚠ Sherdog ID non renseigné. Va sur sherdog.com/organizations, trouve l&apos;org et copie le slug de l&apos;URL.
            </div>
          )}
          <Field label="Sherdog ID" hint="ex: Cage-Warriors-186 (le slug complet dans l'URL)">
            <input className={inputCls} value={form.sherdogId} onChange={e => setForm(f => ({ ...f, sherdogId: e.target.value }))} placeholder="Slug-Org-123" />
          </Field>
          <CopyBlock code={snip.scraper(form)} />
          <ConfirmBox label="J'ai ajouté la ligne dans scrape_sherdog.py et sauvegardé" checked={!!confirmed[4]} onChange={v => setConfirm(4, v)} />
        </div>
      );

      case 5: return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Valider que le scraper détecte bien les events avant d&apos;insérer en production.</p>
          <CopyBlock code={snip.dryRun(form)} />
          <div className="text-sm text-gray-400 space-y-1">
            <p>Dans la sortie, vérifier :</p>
            <p className="text-gray-300">✓ Nombre d&apos;events &gt; 0</p>
            <p className="text-gray-300">✓ Dates cohérentes (ni trop lointain ni trop ancien)</p>
            <p className="text-gray-300">✓ Aucune erreur HTTP / scraping</p>
          </div>
          <ConfirmBox label="Dry-run exécuté et résultats validés" checked={!!confirmed[5]} onChange={v => setConfirm(5, v)} />
        </div>
      );

      case 6: return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Insérer les events et les fighters en base de données de production.</p>
          <CopyBlock code={snip.sync(form)} />
          <div className="text-sm text-gray-400">
            Vérifier dans Supabase : <span className="text-green-300 font-mono text-xs">SELECT count(*) FROM events WHERE organization = &apos;{form.name || '...'}&apos;</span>
          </div>
          <ConfirmBox label="Sync terminé, events visibles en DB" checked={!!confirmed[6]} onChange={v => setConfirm(6, v)} />
        </div>
      );

      case 7: return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Ajouter l&apos;org au workflow automatique quotidien. Modifier les 4 steps dans <span className="text-white">daily.yml</span>.</p>
          <CopyBlock code={snip.ci(form)} />
          <p className="text-sm text-gray-400 mt-2">Puis commit + push — le scraper inclura l&apos;org à chaque run quotidien.</p>
          <div className="mt-4">
            <p className="text-gray-500 text-xs mb-2">À ajouter également dans STATIC_FALLBACK_ORGS (après l&apos;activation, pour le support offline) :</p>
            <CopyBlock code={snip.fallback(form)} />
          </div>
          <ConfirmBox label="daily.yml mis à jour, commité et pushé" checked={!!confirmed[7]} onChange={v => setConfirm(7, v)} />
        </div>
      );

      case 8: return (
        <div className="space-y-5">
          <p className="text-gray-400 text-sm">Dernière étape : activer l&apos;org dans l&apos;app et notifier les utilisateurs.</p>

          {!wizActivated ? (
            <button onClick={activateInWizard} disabled={wizActivating} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors">
              {wizActivating ? 'Activation...' : `Activer "${form.name}" dans l'app →`}
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-green-400 text-lg">✓</span>
              <span className="text-green-300 text-sm font-medium">{form.name} est maintenant actif — visible dans MyOrgsScreen</span>
            </div>
          )}

          {wizActivated && (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm font-medium">Notification push — éditable avant envoi</p>
              {(['title', 'body', 'titleEn', 'bodyEn'] as const).map(key => (
                <div key={key}>
                  <label className="text-gray-500 text-xs mb-1 block">
                    {key === 'title' ? 'Titre FR' : key === 'body' ? 'Corps FR' : key === 'titleEn' ? 'Titre EN' : 'Corps EN'}
                  </label>
                  <input className={inputCls} value={wizNotif[key]} onChange={e => setWizNotif(n => ({ ...n, [key]: e.target.value }))} />
                </div>
              ))}
              {wizNotifResult ? (
                <p className="text-sm text-gray-300">{wizNotifResult}</p>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setWizNotifResult('— Notification ignorée')} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 hover:border-gray-500 rounded-xl transition-colors">
                    Passer sans notifier
                  </button>
                  <button onClick={sendWizNotif} disabled={wizNotifSending || !wizNotif.title} className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                    {wizNotifSending ? 'Envoi...' : 'Envoyer la notification →'}
                  </button>
                </div>
              )}
              {wizNotifResult && (
                <div className="mt-4 p-4 bg-gray-800/50 border border-green-500/30 rounded-xl text-center">
                  <p className="text-green-400 font-semibold mb-1">🎉 {form.name} est en ligne !</p>
                  <p className="text-gray-400 text-sm">L&apos;organisation est active et les utilisateurs sont notifiés.</p>
                  <button onClick={() => { resetWizard(); setActiveTab('list'); }} className="mt-3 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                    Retour à la liste →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );

      default: return null;
    }
  }

  // ─ Render
  return (
    <div>
      {/* Header + Tabs */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-bold">Organisations</h1>
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          <button onClick={() => setActiveTab('list')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
            Liste
          </button>
          <button onClick={() => { setActiveTab('add'); resetWizard(); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'add' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            + Nouvelle org
          </button>
        </div>
      </div>

      {/* ── Tab : Liste ──────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        loading ? <p className="text-gray-400">Chargement...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  {['•', 'Nom complet', 'Alias', 'Tier', 'Région', 'Actif', 'Ordre', 'Actions'].map(h => (
                    <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => (
                  <tr key={org.id} className="border-b border-gray-800/50">
                    <td className="py-3 pr-4"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: org.accent_dark }} /></td>
                    <td className="py-3 pr-4 text-white font-medium">{org.name}</td>
                    <td className="py-3 pr-4 text-gray-300">{org.short_name ?? <span className="text-gray-600">—</span>}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${org.tier === 'major' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-300'}`}>{org.tier}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{org.region ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {org.is_active ? <span className="text-green-400">✓ Actif</span> : (
                        <button onClick={() => activate(org)} disabled={activating === org.id} className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors">
                          {activating === org.id ? '...' : 'Activer'}
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-400">{org.display_order}</td>
                    <td className="py-3">
                      <button onClick={() => openEdit(org)} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 rounded-lg transition-colors">Éditer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Tab : Wizard ─────────────────────────────────────────────────────── */}
      {activeTab === 'add' && (
        <div className="max-w-2xl">
          {/* Step indicator */}
          <div className="flex items-start mb-8 overflow-x-auto pb-2">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step || (n === 2 && dbResult?.ok === true);
              const current = n === step;
              return (
                <div key={n} className="flex items-start">
                  <div className="flex flex-col items-center gap-1 min-w-[56px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-green-500 text-white' : current ? 'bg-red-600 text-white ring-2 ring-red-400/30' : 'bg-gray-800 text-gray-500'}`}>
                      {done ? '✓' : n}
                    </div>
                    <span className={`text-xs text-center leading-tight whitespace-nowrap ${current ? 'text-white' : done ? 'text-green-400' : 'text-gray-600'}`}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mt-4 flex-shrink-0 h-px w-3 ${n < step ? 'bg-green-500' : 'bg-gray-700'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 min-h-[300px]">
            <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold">{step}</span>
              {STEPS[step - 1]}
            </h2>
            {renderWizardStep()}
          </div>

          {/* Navigation */}
          {step < 8 && (
            <div className="flex gap-3 justify-between mt-4">
              <button
                onClick={() => step > 1 ? setStep(s => s - 1) : (resetWizard(), setActiveTab('list'))}
                className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
              >
                {step === 1 ? '← Annuler' : '← Retour'}
              </button>
              {step !== 2 && (
                <button
                  disabled={!canNext()}
                  onClick={() => setStep(s => s + 1)}
                  className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Continuer →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Activer (depuis Liste) ──────────────────────────────────────── */}
      {activateOrg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white text-lg font-bold mb-1">{activateOrg.name} activé ✓</h2>
            <p className="text-gray-400 text-sm mb-5">Notifier les utilisateurs de l&apos;arrivée de cette organisation ?</p>
            <div className="space-y-3 mb-5">
              {(['title', 'body', 'titleEn', 'bodyEn'] as const).map(key => (
                <div key={key}>
                  <label className="text-gray-400 text-xs mb-1 block">{key === 'title' ? 'Titre FR' : key === 'body' ? 'Corps FR' : key === 'titleEn' ? 'Titre EN' : 'Corps EN'}</label>
                  <input className={inputCls} value={notif[key]} onChange={e => setNotif(n => ({ ...n, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            {notifResult && <p className="text-sm mb-4 text-gray-300">{notifResult}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setActivateOrg(null)} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">Fermer</button>
              <button onClick={sendNotif} disabled={notifSending || !notif.title} className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                {notifSending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Éditer ─────────────────────────────────────────────────────── */}
      {editOrg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white text-lg font-bold mb-5">Éditer — {editOrg.name}</h2>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Alias (shortName)</label>
                <input placeholder="vide = nom complet" className={inputCls} value={editForm.short_name ?? ''} onChange={e => setEditForm(f => ({ ...f, short_name: e.target.value || null }))} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Tier</label>
                <select className={selectCls} value={editForm.tier} onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as 'major' | 'regional' }))}>
                  <option value="major">major</option><option value="regional">regional</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Région</label>
                <input className={inputCls} value={editForm.region ?? ''} onChange={e => setEditForm(f => ({ ...f, region: e.target.value || null }))} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Pays</label>
                <input className={inputCls} value={editForm.country ?? ''} onChange={e => setEditForm(f => ({ ...f, country: e.target.value || null }))} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Couleur dark</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" value={editForm.accent_dark ?? '#888888'} onChange={e => setEditForm(f => ({ ...f, accent_dark: e.target.value }))} />
                  <input className={inputCls} value={editForm.accent_dark ?? ''} onChange={e => setEditForm(f => ({ ...f, accent_dark: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Couleur light</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" value={editForm.accent_light ?? '#888888'} onChange={e => setEditForm(f => ({ ...f, accent_light: e.target.value }))} />
                  <input className={inputCls} value={editForm.accent_light ?? ''} onChange={e => setEditForm(f => ({ ...f, accent_light: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Ordre</label>
                <input type="number" className={inputCls} value={editForm.display_order ?? 100} onChange={e => setEditForm(f => ({ ...f, display_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <label className="text-gray-400 text-sm">Has Rankings</label>
                <button onClick={() => setEditForm(f => ({ ...f, has_rankings: !f.has_rankings }))} className={`w-10 h-6 rounded-full transition-colors ${editForm.has_rankings ? 'bg-red-600' : 'bg-gray-700'}`}>
                  <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-1 ${editForm.has_rankings ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditOrg(null)} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 transition-colors">Annuler</button>
              <button onClick={saveEdit} disabled={editSaving} className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
