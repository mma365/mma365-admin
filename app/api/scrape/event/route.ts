import { spawn } from 'child_process';
import path from 'path';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const { sherdog_url, apply } = await request.json();

  const scrapersPath = process.env.SCRAPERS_PATH;
  if (!scrapersPath) {
    return new Response(
      `data: ${JSON.stringify('[ERREUR] SCRAPERS_PATH non configuré dans .env.local')}\n\ndata: "[DONE:1]"\n\n`,
      { headers: sseHeaders() }
    );
  }

  const scriptPath = path.join(scrapersPath, 'update.py');
  const python = process.env.PYTHON_CMD || 'python';
  // -u : unbuffered stdout (logs appear in real-time instead of all at the end)
  const args = ['-u', scriptPath, '--event-url', sherdog_url];
  if (!apply) args.push('--dry-run');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn(python, args, {
        cwd: scrapersPath,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });

      function send(text: string) {
        for (const line of text.split('\n')) {
          const trimmed = line.trimEnd();
          if (trimmed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(trimmed)}\n\n`));
          }
        }
      }

      child.stdout.on('data', (d: Buffer) => send(d.toString('utf8')));
      child.stderr.on('data', (d: Buffer) => send(`[stderr] ${d.toString('utf8')}`));

      child.on('close', (code) => {
        controller.enqueue(encoder.encode(`data: "[DONE:${code ?? 0}]"\n\n`));
        controller.close();
      });

      child.on('error', (err) => {
        send(`[ERREUR] ${err.message}`);
        controller.enqueue(encoder.encode(`data: "[DONE:1]"\n\n`));
        controller.close();
      });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
}
