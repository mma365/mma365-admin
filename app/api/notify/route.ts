import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type LinkInfo = { type: 'event' | 'fighter' | 'fight'; id: string } | undefined;

function buildData(link: LinkInfo): Record<string, string> {
  if (!link) return {};
  if (link.type === 'event')   return { type: 'event_today',    eventId:   link.id };
  if (link.type === 'fighter') return { type: 'ranking_change', fighterId: link.id };
  if (link.type === 'fight')   return { type: 'fight_result',   fightId:   link.id };
  return {};
}

export async function POST(request: Request) {
  try {
    const { title, body, link } = await request.json();
    if (!title || !body) return NextResponse.json({ error: 'title et body requis' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('notify_global', true);

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'Aucun token trouvé' }, { status: 404 });
    }

    const data = buildData(link as LinkInfo);

    const messages = tokens.map(({ token }: { token: string }) => ({
      to: token,
      title,
      body,
      sound: 'default',
      data,
    }));

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
