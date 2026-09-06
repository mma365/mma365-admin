import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import path from 'path';
import type { ArticleSubject } from './factDossier';

/**
 * Génération d'un article MMA365 (FR + EN + captions Insta) à partir d'un
 * dossier de faits fermé. La charte éditoriale (docs/ligne-editoriale.md)
 * est la source de vérité du ton : elle est injectée telle quelle dans le
 * prompt système.
 */

export type GeneratedArticle = {
  title_fr: string;
  title_en: string;
  excerpt_fr: string;
  excerpt_en: string;
  body_fr: string;
  body_en: string;
  insta_caption_fr: string;
  insta_caption_en: string;
  angle: string;
  slug: string;
};

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    angle: { type: 'string', description: "L'angle narratif choisi, en une phrase" },
    title_fr: { type: 'string' },
    title_en: { type: 'string' },
    excerpt_fr: { type: 'string', description: 'Accroche de 1-2 phrases (listes du site, meta description)' },
    excerpt_en: { type: 'string' },
    body_fr: { type: 'string', description: "Corps de l'article en Markdown (paragraphes séparés par des lignes vides)" },
    body_en: { type: 'string' },
    insta_caption_fr: { type: 'string' },
    insta_caption_en: { type: 'string' },
    slug: { type: 'string', description: 'Slug URL kebab-case en anglais, court (4-6 mots)' },
  },
  required: [
    'angle', 'title_fr', 'title_en', 'excerpt_fr', 'excerpt_en',
    'body_fr', 'body_en', 'insta_caption_fr', 'insta_caption_en', 'slug',
  ],
  additionalProperties: false,
};

function loadCharte(): string {
  try {
    return readFileSync(path.join(process.cwd(), 'docs', 'ligne-editoriale.md'), 'utf-8');
  } catch {
    return '';
  }
}

const TYPE_LABEL: Record<ArticleSubject['type'], string> = {
  preview: "une preview d'event (~250 mots)",
  focus: 'un focus combat (~300 mots)',
  portrait: 'un portrait de fighter (~300-350 mots)',
  libre: 'un article libre (~250-350 mots)',
};

function buildSystemPrompt(): string {
  const charte = loadCharte();
  return `Tu es le rédacteur de MMA365, média MMA francophone. Tu écris des articles courts pour des fans casual.

Voici la charte éditoriale de MMA365. Elle est contraignante, applique chacune de ses règles :

<charte>
${charte}
</charte>

Règles de production impératives, en plus de la charte :
1. DOSSIER FERMÉ : tu n'utilises QUE les faits présents dans le dossier fourni. Aucun fait externe, aucune supposition, aucune extrapolation. Un fait absent du dossier n'existe pas. Si le dossier ne mentionne pas l'heure ou le diffuseur, tu ne les inventes pas, tu les omets.
2. Détecte toi-même les histoires dans les données : premières défaites, séries, revanches (même adversaire deux fois), longues absences, adversaires communs entre les deux fighters, progression visible dans les noms d'events, position au ranking.
3. UNE SEULE statistique chiffrée marquante par article (deux maximum). Le reste des faits s'écrit en mots.
4. JAMAIS de tiret long (—) ni de tiret demi-cadratin (–) dans aucun texte produit. Incises par virgules ou parenthèses, ou phrases séparées.
5. La version EN est un article à part entière écrit pour un lecteur anglophone, pas une traduction littérale.
6. Caption Instagram : 2-3 phrases courtes et percutantes, 1 emoji maximum, se termine par « L'article complet sur MMA365, lien en bio. » (EN : "Full story on MMA365, link in bio.") puis 4-6 hashtags pertinents (#MMA, l'organisation, les noms des fighters, #MMAFrance côté FR).
7. Le corps est en Markdown simple : uniquement des paragraphes séparés par des lignes vides. Pas de titres, pas de listes, pas de gras.
8. Les dates relatives (« samedi », « le mois dernier ») se calculent par rapport à la date du jour fournie dans le dossier.`;
}

export async function generateArticle(
  subject: ArticleSubject,
  dossier: Record<string, unknown>,
  angleHint?: string
): Promise<GeneratedArticle> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquante dans .env.local');
  }
  const client = new Anthropic();

  const userPrompt = `Rédige ${TYPE_LABEL[subject.type]} à partir de ce dossier de faits.
${angleHint ? `\nAngle imposé par la rédaction : ${angleHint}` : "\nChoisis l'angle le plus fort que tu détectes dans les données."}

<dossier>
${JSON.stringify(dossier, null, 1)}
</dossier>`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Génération refusée par le modèle');
  }

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Réponse sans contenu texte');
  }

  const article = JSON.parse(text.text) as GeneratedArticle;

  // Filet de sécurité charte : aucun tiret long/demi-cadratin ne doit passer
  const strip = (s: string) => s.replace(/\s*—\s*/g, ', ').replace(/\s*–\s*/g, ', ');
  for (const key of Object.keys(article) as (keyof GeneratedArticle)[]) {
    article[key] = strip(article[key]);
  }

  return article;
}
