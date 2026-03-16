import { NextRequest, NextResponse } from 'next/server';

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing Overpass query' }, { status: 400 });
    }

    let lastError = '';

    // Try each server in order
    for (const server of OVERPASS_SERVERS) {
      try {
        const response = await fetch(server, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(120000), // 2 minute timeout
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }

        // 429 = rate limited, 504 = timeout — try next server
        if (response.status === 429 || response.status === 504) {
          lastError = `Server ${server} returned ${response.status}`;
          continue;
        }

        // Other errors — return immediately
        const text = await response.text();
        return NextResponse.json(
          { error: `Overpass API error: ${response.status} - ${text.slice(0, 200)}` },
          { status: response.status }
        );
      } catch (fetchErr) {
        // Network error or timeout — try next server
        lastError = fetchErr instanceof Error ? fetchErr.message : 'Network error';
        continue;
      }
    }

    // All servers failed
    return NextResponse.json(
      { error: `All Overpass servers timed out or failed. Last error: ${lastError}. Try selecting a smaller area.` },
      { status: 504 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
