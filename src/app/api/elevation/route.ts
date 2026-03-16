import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const south = searchParams.get('south');
  const north = searchParams.get('north');
  const west = searchParams.get('west');
  const east = searchParams.get('east');
  const demtype = searchParams.get('demtype') || 'COP30';

  if (!south || !north || !west || !east) {
    return NextResponse.json({ error: 'Missing bbox parameters' }, { status: 400 });
  }

  const apiKey = process.env.OPENTOPO_API_KEY;
  if (!apiKey || apiKey === 'your_opentopography_api_key_here') {
    return NextResponse.json(
      { error: 'OpenTopography API key not configured. Add OPENTOPO_API_KEY to .env.local' },
      { status: 500 }
    );
  }

  const url = new URL('https://portal.opentopography.org/API/globaldem');
  url.searchParams.set('demtype', demtype);
  url.searchParams.set('south', south);
  url.searchParams.set('north', north);
  url.searchParams.set('west', west);
  url.searchParams.set('east', east);
  url.searchParams.set('outputFormat', 'GTiff');
  url.searchParams.set('API_Key', apiKey);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(240000), // 4 minute timeout for large 90m areas
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `OpenTopography API error: ${response.status} - ${text}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-DEM-Source': demtype,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
