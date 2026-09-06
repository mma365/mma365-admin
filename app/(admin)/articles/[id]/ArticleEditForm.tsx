'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Article = {
  id: string;
  type: string;
  status: string;
  source: string;
  angle: string | null;
  slug: string | null;
  title_fr: string; title_en: string;
  excerpt_fr: string; excerpt_en: string;
  body_fr: string; body_en: string;
  insta_caption_fr: string; insta_caption_en: string;
  published_web_at: string | null;
  insta_posted_at: string | null;
  fact_dossier: unknown;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  preview: '🔮 Preview',
  focus: '🥊 Focus combat',
  portrait: '👤 Portrait',
  libre: '📝 Libre',
};

function Field({
  label, value, onChange, rows,
}: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="block text-gray-500 text-xs mb-1">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 leading-relaxed"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
        />
      )}
    </div>
  );
}

export default function ArticleEditForm({ article }: { article: Article }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title_fr: article.title_fr, title_en: article.title_en,
    excerpt_fr: article.excerpt_fr, excerpt_en: article.excerpt_en,
    body_fr: article.body_fr, body_en: article.body_en,
    insta_caption_fr: article.insta_caption_fr, insta_caption_en: article.insta_caption_en,
    slug: article.slug ?? '',
  });
  const [publishedWebAt, setPublishedWebAt] = useState(article.published_web_at);
  const [instaPostedAt, setInstaPostedAt] = useState(article.insta_posted_at);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<'fr' | 'en' | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function patch(extra: Record<string, unknown> = {}, note = 'Enregistré') {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      setMessage(note);
      router.refresh();
    } catch (err) {
      setMessage(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublishWeb() {
    const next = publishedWebAt ? null : new Date().toISOString();
    setPublishedWebAt(next);
    await patch(
      { published_web_at: next, status: next ? 'published' : 'draft' },
      next ? 'Publié sur le web' : 'Dépublié du web'
    );
  }

  async function toggleInstaPosted() {
    const next = instaPostedAt ? null : new Date().toISOString();
    setInstaPostedAt(next);
    await patch({ insta_posted_at: next }, next ? 'Marqué posté sur Insta' : 'Marquage Insta retiré');
  }

  async function copyCaption(lang: 'fr' | 'en') {
    await navigator.clipboard.writeText(lang === 'fr' ? form.insta_caption_fr : form.insta_caption_en);
    setCopied(lang);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleDelete() {
    if (!confirm('Supprimer définitivement cet article ?')) return;
    await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
    router.push('/articles');
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">{form.title_fr || 'Sans titre'}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {TYPE_LABELS[article.type] ?? article.type}
            {article.angle && <> · Angle : {article.angle}</>}
            {article.source === 'pipeline' && <> · ⚙️ généré par le pipeline</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-gray-400 text-xs">{message}</span>}
          <button
            onClick={() => patch()}
            disabled={saving}
            className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Canaux */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={togglePublishWeb}
          disabled={saving}
          className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
            publishedWebAt
              ? 'bg-green-600/15 border-green-600/40 text-green-400'
              : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
          }`}
        >
          {publishedWebAt ? `Web ✓ publié le ${publishedWebAt.slice(0, 10)}` : 'Publier sur le web'}
        </button>
        <button
          onClick={toggleInstaPosted}
          disabled={saving}
          className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
            instaPostedAt
              ? 'bg-green-600/15 border-green-600/40 text-green-400'
              : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
          }`}
        >
          {instaPostedAt ? `Insta ✓ posté le ${instaPostedAt.slice(0, 10)}` : 'Marquer posté sur Insta'}
        </button>
      </div>

      {/* FR / EN côte à côte */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <h2 className="text-white text-sm font-semibold">🇫🇷 Français</h2>
          <Field label="Titre" value={form.title_fr} onChange={(v) => set('title_fr', v)} />
          <Field label="Accroche" value={form.excerpt_fr} onChange={(v) => set('excerpt_fr', v)} rows={2} />
          <Field label="Article" value={form.body_fr} onChange={(v) => set('body_fr', v)} rows={16} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-500 text-xs">Caption Instagram</label>
              <button onClick={() => copyCaption('fr')} className="text-red-400 hover:text-red-300 text-xs">
                {copied === 'fr' ? 'Copiée ✓' : 'Copier'}
              </button>
            </div>
            <textarea
              value={form.insta_caption_fr}
              onChange={(e) => set('insta_caption_fr', e.target.value)}
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 leading-relaxed"
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <h2 className="text-white text-sm font-semibold">🇬🇧 English</h2>
          <Field label="Title" value={form.title_en} onChange={(v) => set('title_en', v)} />
          <Field label="Excerpt" value={form.excerpt_en} onChange={(v) => set('excerpt_en', v)} rows={2} />
          <Field label="Article" value={form.body_en} onChange={(v) => set('body_en', v)} rows={16} />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-500 text-xs">Instagram caption</label>
              <button onClick={() => copyCaption('en')} className="text-red-400 hover:text-red-300 text-xs">
                {copied === 'en' ? 'Copied ✓' : 'Copier'}
              </button>
            </div>
            <textarea
              value={form.insta_caption_en}
              onChange={(e) => set('insta_caption_en', e.target.value)}
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Slug + dossier de faits */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 space-y-4">
        <Field label="Slug (URL du site)" value={form.slug} onChange={(v) => set('slug', v)} />
        <details>
          <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">
            Dossier de faits utilisé par la génération
          </summary>
          <pre className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto max-h-96 overflow-y-auto">
            {JSON.stringify(article.fact_dossier, null, 2)}
          </pre>
        </details>
      </div>

      <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 text-xs transition-colors">
        Supprimer cet article
      </button>
    </div>
  );
}
