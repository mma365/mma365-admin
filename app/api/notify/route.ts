import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type LinkInfo =
  | { type: 'event' | 'fighter' | 'fight'; id: string }
  | { type: 'url'; url: string }
  | undefined;

function buildData(link: LinkInfo): Record<string, string> {
  if (!link) return {};
  if (link.type === 'event')   return { type: 'event_today',    eventId:   link.id };
  if (link.type === 'fighter') return { type: 'ranking_change', fighterId: link.id };
  if (link.type === 'fight')   return { type: 'fight_result',   fightId:   link.id };
  if (link.type === 'url')     return { type: 'broadcast',      url:       link.url };
  return {};
}

export async function POST(request: Request) {
  try {
    const { title, body, titleEn, bodyEn, link } = await request.json();
    if (!title || !body) return NextResponse.json({ error: 'title et body requis' }, { status: 400 });
    if (link?.type === 'url' && !String(link.url ?? '').startsWith('https://')) {
      return NextResponse.json({ error: 'le lien externe doit commencer par https://' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, locale')
      .eq('notify_global', true);

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'Aucun token trouvé' }, { status: 404 });
    }

    const data = buildData(link as LinkInfo);

    type TokenRow = { token: string; locale: string | null };
    const toMessages = (rows: TokenRow[], t: string, b: string) =>
      rows.map(({ token }) => ({ to: token, title: t, body: b, sound: 'default', data }));

    // Variante EN fournie → chaque téléphone reçoit sa langue (FR par défaut
    // pour les locales fr*, EN pour tout le reste y compris locale inconnue).
    const hasEnVariant = Boolean(titleEn && bodyEn);
    const isFr = (l: string | null) => typeof l === 'string' && l.toLowerCase().startsWith('fr');

    const messages = hasEnVariant
      ? [
          ...toMessages((tokens as TokenRow[]).filter((r) => isFr(r.locale)), title, body),
          ...toMessages((tokens as TokenRow[]).filter((r) => !isFr(r.locale)), titleEn, bodyEn),
        ]
      : toMessages(tokens as TokenRow[], title, body);

    // Expo accepts max 100 per batch
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    await Promise.all(
      chunks.map((chunk) =>
        fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk),
        })
      )
    );

    return NextResponse.json({ sent: tokens.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
