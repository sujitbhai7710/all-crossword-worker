/**
 * Crossword Source Test Worker
 * Tests multiple approaches for each broken/partially-working source
 * No database — pure testing purpose
 */

const HEADERS = {
  chrome: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  chromeJson: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': 'application/json,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  nytBypass: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'x-games-auth-bypass': 'true',
    'Referer': 'https://www.nytimes.com/crosswords',
  },
  amuseLabs: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.latimes.com/games/mini-crossword',
    'Origin': 'https://www.latimes.com',
  },
};

async function fetchWithHeaders(url, headers = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { ...HEADERS.chrome, ...headers },
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await resp.text();
    return {
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      bodyLen: text.length,
      bodyPreview: text.slice(0, 2000),
      body: text,
    };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, error: e.message, url };
  }
}

async function fetchFollow(url, headers = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { ...HEADERS.chrome, ...headers },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await resp.text();
    return {
      status: resp.status,
      statusText: resp.statusText,
      bodyLen: text.length,
      bodyPreview: text.slice(0, 2000),
      body: text,
    };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, error: e.message, url };
  }
}

function extractBetween(text, start, end) {
  const s = text.indexOf(start);
  if (s === -1) return null;
  const e = text.indexOf(end, s + start.length);
  if (e === -1) return null;
  return text.slice(s + start.length, e);
}

// ============ LA TIMES MINI ============
async function testLATimesMini(date) {
  const compact = date.replace(/-/g, '');
  const results = {};

  // A1: Direct CDN (known 302)
  results.a1_direct = await fetchWithHeaders(
    `https://lat.amuselabs.com/lat/crossword?id=latimes-mini-${compact}&set=latimes-mini`
  );

  // A2: Direct CDN follow redirects
  results.a2_follow = await fetchFollow(
    `https://lat.amuselabs.com/lat/crossword?id=latimes-mini-${compact}&set=latimes-mini`
  );

  // A3: Date-picker page
  const picker = await fetchFollow(
    'https://lat.amuselabs.com/lat/date-picker?set=latimes-mini',
    HEADERS.amuseLabs
  );
  results.a3_picker = {
    status: picker.status,
    bodyLen: picker.bodyLen,
    hasParams: picker.body?.includes('id="params"'),
    hasRawsps: picker.body?.includes('rawsps'),
    hasRawpuz: picker.body?.includes('rawpuz'),
  };

  // Extract loadToken
  let loadToken = null;
  let rawpuzData = null;
  if (picker.body) {
    const pm = picker.body.match(/<script[^>]*id="params"[^>]*>([\s\S]*?)<\/script>/i);
    if (pm) {
      try {
        const params = JSON.parse(pm[1]);
        if (params.rawsps) {
          const decoded = JSON.parse(atob(params.rawsps));
          loadToken = decoded.loadToken || null;
        }
        if (params.rawpuz) {
          try { rawpuzData = JSON.parse(atob(params.rawpuz)); } catch(e) {}
        }
      } catch (e) { results.a3_parse_error = e.message; }
    }
    // Also try window.pickerParams
    const pp = picker.body.match(/pickerParams\s*=\s*({[\s\S]*?});/);
    if (pp && !loadToken) {
      try {
        const ppo = JSON.parse(pp[1]);
        if (ppo.rawsps) {
          const decoded = JSON.parse(atob(ppo.rawsps));
          loadToken = decoded.loadToken || null;
        }
      } catch(e) {}
    }
  }
  results.a3_loadToken = loadToken ? loadToken.slice(0, 50) + '...' : null;
  results.a3_rawpuz = rawpuzData ? { hasData: true, keys: Object.keys(rawpuzData).slice(0, 10) } : null;

  // A4: With loadToken
  if (loadToken) {
    const urlT = `https://lat.amuselabs.com/lat/crossword?id=latimes-mini-${compact}&set=latimes-mini&loadToken=${encodeURIComponent(loadToken)}`;
    results.a4_with_token = await fetchWithHeaders(urlT, HEADERS.amuseLabs);
    results.a4_with_token_follow = await fetchFollow(urlT, HEADERS.amuseLabs);
  }

  // A5: Different referer
  results.a5_games_referer = await fetchWithHeaders(
    `https://lat.amuselabs.com/lat/crossword?id=latimes-mini-${compact}&set=latimes-mini`,
    { 'Referer': 'https://www.latimes.com/games/mini-crossword/' }
  );

  // A6: LA Times games page
  results.a6_latimes_page = await fetchFollow(
    'https://www.latimes.com/games/mini-crossword/',
    { 'User-Agent': HEADERS.chrome['User-Agent'] }
  );

  // A7: Embed mode
  results.a7_embed = await fetchWithHeaders(
    `https://lat.amuselabs.com/lat/crossword?id=latimes-mini-${compact}&set=latimes-mini&embed=1`,
    HEADERS.amuseLabs
  );

  return results;
}

// ============ USA TODAY QUICK ============
async function testUSATodayQuick(date) {
  const results = {};

  // A1: GraphQL GET
  results.a1_graphql_get = await fetchWithHeaders(
    `https://play.usatoday.com/api/query?query=query{findGameData(type:"quickcross",date:"${date}"){id gameId publishDate type}}&operationName=anonymousCrosswordFindGameData`,
    { 'x-api-type': 'games', 'x-sitecode': 'USAT', 'Referer': 'https://play.usatoday.com/crossword', ...HEADERS.chromeJson }
  );

  // A2: GraphQL POST
  try {
    const r = await fetch('https://play.usatoday.com/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-type': 'games', 'x-sitecode': 'USAT', 'Referer': 'https://play.usatoday.com/crossword', ...HEADERS.chromeJson },
      body: JSON.stringify({ query: 'query acfdgd($type:String!,$date:String!){findGameData(type:$type,date:$date){id gameId publishDate type}}', variables: { type: 'quickcross', date }, operationName: 'acfdgd' }),
    });
    results.a2_graphql_post = { status: r.status, body: (await r.text()).slice(0, 500) };
  } catch(e) { results.a2_graphql_post = { error: e.message }; }

  // A3: Landing page
  results.a3_landing = await fetchFollow('https://play.usatoday.com/quick-cross/', HEADERS.chrome);
  if (results.a3_landing.body) {
    const nd = extractBetween(results.a3_landing.body, '<script id="__NEXT_DATA__" type="application/json">', '</script>');
    results.a3_next_data = nd ? { found: true, len: nd.length, preview: nd.slice(0, 500) } : { found: false };
  }

  // A4: AmuseLabs - try different set names
  const sets = ['usatodayquickcross', 'usa-quick', 'quickcross', 'usatoday-mini'];
  results.a4_amuselabs_sets = {};
  for (const set of sets) {
    const r = await fetchWithHeaders(`https://cdn2.amuselabs.com/pmm/date-picker?set=${set}`, HEADERS.chrome);
    results.a4_amuselabs_sets[set] = { status: r.status, len: r.bodyLen, preview: r.bodyPreview?.slice(0, 200) };
  }

  // A5: Try uclick XML for Quick Cross
  const yy = date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10);
  results.a5_uclick_xml = await fetchWithHeaders(
    `http://picayune.uclick.com/comics/usaqc/data/usaqc${yy}-data.xml`,
    HEADERS.chrome
  );

  // A6: USA Today crossword landing (not quick)
  results.a6_crossword_landing = await fetchFollow('https://play.usatoday.com/crossword/', HEADERS.chrome);

  return results;
}

// ============ NEW YORKER ============
async function testNewYorker(date) {
  const results = {};
  const [y, m, d] = date.split('-');

  // A1: Landing page
  results.a1_landing = await fetchFollow('https://www.newyorker.com/puzzles-and-games-dept/crossword', HEADERS.chrome);
  let puzzleUrls = [];
  if (results.a1_landing.body) {
    const ms = results.a1_landing.body.matchAll(/href="(\/puzzles-and-games-dept\/crossword\/[^"]+)"/g);
    for (const m of ms) puzzleUrls.push(m[1]);
  }
  results.a1_puzzle_urls = [...new Set(puzzleUrls)].slice(0, 5);

  // A2: Date page
  results.a2_date_page = await fetchFollow(
    `https://www.newyorker.com/puzzles-and-games-dept/crossword/${y}/${m}/${d}`,
    HEADERS.chrome
  );

  // A3: Conde Nast API
  results.a3_conde_api = await fetchWithHeaders(
    'https://puzzles-games-api.gp-prod.conde.digital/api/v1/games',
    { ...HEADERS.chromeJson, 'Origin': 'https://www.newyorker.com', 'Referer': 'https://www.newyorker.com/' }
  );

  // A4: Try UUID from landing page
  let uuid = null;
  if (results.a1_landing.body) {
    const um = results.a1_landing.body.match(/"id":"([0-9a-f-]{36})"/);
    if (um) {
      uuid = um[1];
      results.a4_uuid = uuid;
      results.a4_conde_response = await fetchWithHeaders(
        `https://puzzles-games-api.gp-prod.conde.digital/api/v1/games/${uuid}`,
        { ...HEADERS.chromeJson, 'Origin': 'https://www.newyorker.com', 'Referer': 'https://www.newyorker.com/puzzles-and-games-dept/crossword' }
      );
    }
  }
  // Also try from date page
  if (!uuid && results.a2_date_page.body) {
    const um2 = results.a2_date_page.body.match(/"id":"([0-9a-f-]{36})"/);
    if (um2) {
      uuid = um2[1];
      results.a4b_uuid_from_date = uuid;
      results.a4b_conde_response = await fetchWithHeaders(
        `https://puzzles-games-api.gp-prod.conde.digital/api/v1/games/${uuid}`,
        { ...HEADERS.chromeJson, 'Origin': 'https://www.newyorker.com', 'Referer': 'https://www.newyorker.com/puzzles-and-games-dept/crossword' }
      );
    }
  }

  // A5: Puzzmo GraphQL
  try {
    const r = await fetch('https://www.puzzmo.com/_api/prod/graphql?PlayGameScreenQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS.chromeJson, 'Origin': 'https://www.puzzmo.com', 'Referer': 'https://www.puzzmo.com/' },
      body: JSON.stringify({ query: 'query PGQ($finderKey:String!){playGameScreen(finderKey:$finderKey){puzzle{puzzle title author}}}', variables: { finderKey: `today:/${date}/crossword` }, operationName: 'PGQ' }),
    });
    results.a5_puzzmo = { status: r.status, body: (await r.text()).slice(0, 500) };
  } catch(e) { results.a5_puzzmo = { error: e.message }; }

  // A6: Mini landing
  results.a6_mini_landing = await fetchFollow('https://www.newyorker.com/puzzles-and-games-dept/mini-crossword', HEADERS.chrome);

  // A7: games.newyorker.com
  results.a7_games_domain = await fetchFollow('https://games.newyorker.com/', HEADERS.chrome);

  // A8: Conde API with Puzzmo-style headers
  results.a8_conde_puzzmo_headers = await fetchWithHeaders(
    'https://puzzles-games-api.gp-prod.conde.digital/api/v1/games',
    { ...HEADERS.chromeJson, 'Origin': 'https://games.newyorker.com', 'Referer': 'https://games.newyorker.com/', 'Puzzmo-Gameplay-Id': crypto.randomUUID() }
  );

  // A9: Try the date page ld+json for puzzle data
  if (results.a2_date_page.body) {
    const ldJson = extractBetween(results.a2_date_page.body, '<script type="application/ld+json">', '</script>');
    if (ldJson) {
      try {
        const parsed = JSON.parse(ldJson);
        results.a9_ldjson = { found: true, type: parsed['@type'], hasGame: !!parsed.game };
      } catch(e) {
        results.a9_ldjson = { found: true, parseError: e.message };
      }
    }
  }

  return results;
}

// ============ GUARDIAN ============
async function testGuardian(date, seriesTag) {
  const results = {};

  // A1: Content API
  results.a1_content_api = await fetchWithHeaders(
    `https://content.guardianapis.com/search?tag=crosswords/series/${seriesTag}&from-date=${date}&to-date=${date}&page-size=1&api-key=test`,
    HEADERS.chromeJson
  );

  // A2: Series page (xword-dl approach)
  const tag = seriesTag === 'weekend-crossword' ? 'weekend-crossword' : seriesTag;
  results.a2_series_page = await fetchFollow(
    `https://www.theguardian.com/crosswords/series/${tag}`,
    HEADERS.chrome
  );

  let puzzleUrls = [];
  if (results.a2_series_page.body) {
    const ms = results.a2_series_page.body.matchAll(/href="(\/crosswords\/${tag}\/\d+)"/g);
    for (const m of ms) puzzleUrls.push(m[1]);
  }
  results.a2_puzzle_urls = [...new Set(puzzleUrls)].slice(0, 5);

  // A3: Fetch first puzzle page
  if (puzzleUrls.length > 0) {
    const page = await fetchFollow(`https://www.theguardian.com${puzzleUrls[0]}`, HEADERS.chrome);
    results.a3_puzzle_page = { status: page.status, bodyLen: page.bodyLen };
    if (page.body) {
      const guIsland = extractBetween(page.body, '<gu-island name="CrosswordComponent"', '</gu-island>');
      results.a3_has_gu_island = !!guIsland;
      if (guIsland) {
        const propsMatch = guIsland.match(/props="([^"]*)"/);
        if (propsMatch) {
          try {
            const decoded = propsMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            const props = JSON.parse(decoded);
            results.a3_has_data = !!props.data;
            results.a3_entry_count = props.data?.entries?.length || 0;
            results.a3_has_solution = props.data?.entries?.some(e => e.solution) || false;
          } catch(e) { results.a3_parse_error = e.message; }
        }
      }
    }
  }

  // A4: Wider date range API
  results.a4_wider_range = await fetchWithHeaders(
    `https://content.guardianapis.com/search?tag=crosswords/series/${seriesTag}&from-date=2026-05-01&to-date=2026-05-31&page-size=10&api-key=test`,
    HEADERS.chromeJson
  );

  // A5: Try without api-key (maybe open endpoint?)
  results.a5_no_key = await fetchWithHeaders(
    `https://content.guardianapis.com/search?tag=crosswords/series/${seriesTag}&from-date=${date}&to-date=${date}&page-size=1`,
    HEADERS.chromeJson
  );

  return results;
}

// ============ NEWSDAY ============
async function testNewsday(date) {
  const compact = date.replace(/-/g, '');
  const results = {};
  results.a1_picker = await fetchWithHeaders('https://cdn2.amuselabs.com/pmm/date-picker?set=creatorsweb', HEADERS.chrome);
  results.a2_direct = await fetchWithHeaders(`https://cdn2.amuselabs.com/pmm/crossword?id=Creators_WEB_${compact}&set=creatorsweb`, HEADERS.chrome);
  results.a3_follow = await fetchFollow(`https://cdn2.amuselabs.com/pmm/crossword?id=Creators_WEB_${compact}&set=creatorsweb`, HEADERS.chrome);
  // Check for rawc
  if (results.a3_follow.body) {
    results.a3_has_rawc = results.a3_follow.body.includes('rawc') || results.a3_follow.body.includes('params');
  }
  return results;
}

// ============ UNIVERSAL ============
async function testUniversal(date) {
  const results = {};
  const token = 'U2FsdGVkX18YuMv20%2B8cekf85%2Friz1H%2FzlWW4bn0cizt8yclLsp7UYv34S77X0aX%0Axa513fPTc5RoN2wa0h4ED9QWuBURjkqWgHEZey0WFL8%3D';
  results.a1_json = await fetchFollow(`https://gamedata.services.amuniversal.com/c/uucom/l/${token}/g/fcx/d/${date}/data.json`, HEADERS.chromeJson);
  if (results.a1_json.status === 200 && results.a1_json.body) {
    try {
      const j = JSON.parse(results.a1_json.body);
      results.a1_has_answers = !!j.AllAnswer;
      results.a1_title = j.Title || null;
    } catch(e) { results.a1_parse_error = e.message; }
  }
  return results;
}

// ============ PUZZMO ============
async function testPuzzmo(date) {
  const results = {};
  try {
    const r = await fetch('https://www.puzzmo.com/_api/prod/graphql?PlayGameScreenQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS.chromeJson, 'Origin': 'https://www.puzzmo.com', 'Referer': 'https://www.puzzmo.com/', 'Puzzmo-Gameplay-Id': crypto.randomUUID() },
      body: JSON.stringify({ query: 'query PGQ($finderKey:String!){playGameScreen(finderKey:$finderKey){puzzle{puzzle title author}}}', variables: { finderKey: `today:/${date}/crossword` }, operationName: 'PGQ' }),
    });
    const t = await r.text();
    results.a1_graphql = { status: r.status, body: t.slice(0, 1000), hasXd: t.includes('## grid') };
  } catch(e) { results.a1_graphql = { error: e.message }; }

  try {
    const r2 = await fetch('https://www.puzzmo.com/_api/prod/graphql?PlayGameScreenQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS.chromeJson, 'Origin': 'https://www.puzzmo.com', 'Referer': 'https://www.puzzmo.com/' },
      body: JSON.stringify({ query: 'query PGQ($finderKey:String!){playGameScreen(finderKey:$finderKey){puzzle{puzzle title author}}}', variables: { finderKey: `today:/${date}/crossword/big` }, operationName: 'PGQ' }),
    });
    results.a2_big = { status: r2.status, body: (await r2.text()).slice(0, 300) };
  } catch(e) { results.a2_big = { error: e.message }; }

  return results;
}

// ============ VOX ============
async function testVox(date) {
  const compact = date.replace(/-/g, '');
  const results = {};
  results.a1_picker = await fetchWithHeaders('https://cdn3.amuselabs.com/vox/date-picker?set=vox', HEADERS.chrome);
  results.a2_direct = await fetchWithHeaders(`https://cdn3.amuselabs.com/vox/crossword?id=vox_${compact}&set=vox`, HEADERS.chrome);
  results.a3_follow = await fetchFollow(`https://cdn3.amuselabs.com/vox/crossword?id=vox_${compact}&set=vox`, HEADERS.chrome);
  if (results.a3_follow.body) {
    results.a3_has_rawc = results.a3_follow.body.includes('rawc');
  }
  return results;
}

// ============ DAILY POP ============
async function testDailyPop(date) {
  const results = {};
  const compact = date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10);
  results.a1_js = await fetchWithHeaders('http://dailypopcrosswordsweb.puzzlenation.com/crosswordSetup.js', HEADERS.chrome);
  let apiKey = null;
  if (results.a1_js.body) {
    const km = results.a1_js.body.match(/API_KEY\s*=\s*["']([^"']+)["']/);
    if (km) apiKey = km[1];
  }
  results.a1_api_key = apiKey;
  if (apiKey) {
    results.a2_api = await fetchWithHeaders(
      `https://api.puzzlenation.com/dailyPopCrosswords/puzzles/daily/${compact}`,
      { ...HEADERS.chromeJson, 'x-api-key': apiKey }
    );
  }
  results.a3_no_key = await fetchWithHeaders(
    `https://api.puzzlenation.com/dailyPopCrosswords/puzzles/daily/${compact}`,
    HEADERS.chromeJson
  );
  return results;
}

// ============ ATLANTIC (verify) ============
async function testAtlantic(date) {
  const compact = date.replace(/-/g, '');
  const results = {};
  results.a1_direct = await fetchWithHeaders(`https://cdn3.amuselabs.com/atlantic/crossword?id=atlantic_${compact}&set=atlantic`, HEADERS.chrome);
  results.a2_follow = await fetchFollow(`https://cdn3.amuselabs.com/atlantic/crossword?id=atlantic_${compact}&set=atlantic`, HEADERS.chrome);
  if (results.a2_follow.body) {
    results.a2_has_rawc = results.a2_follow.body.includes('rawc') || results.a2_follow.body.includes('id="params"');
  }
  return results;
}

// ============ NYT (verify) ============
async function testNYT(date) {
  const results = {};
  results.a1_no_bypass = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/daily/${date}.json`, HEADERS.chromeJson);
  results.a2_bypass = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/daily/${date}.json`, HEADERS.nytBypass);
  results.a3_mini_no_bypass = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/${date}.json`, HEADERS.chromeJson);
  results.a4_mini_bypass = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/${date}.json`, HEADERS.nytBypass);

  // Check if bypass returns actual data
  if (results.a2_bypass.status === 200 && results.a2_bypass.body) {
    try {
      const j = JSON.parse(results.a2_bypass.body);
      results.a2_has_answers = !!j.body?.[0]?.cells?.[0]?.answer || !!j.body?.[0]?.clues;
    } catch(e) {}
  }

  // Future dates
  const fd = '2026-05-28';
  results.a5_future = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/daily/${fd}.json`, HEADERS.nytBypass);
  results.a6_future_mini = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/mini/${fd}.json`, HEADERS.nytBypass);

  // Bonus & Midi
  results.a7_bonus = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/bonus/${date}.json`, HEADERS.nytBypass);
  results.a8_midi = await fetchWithHeaders(`https://www.nytimes.com/svc/crosswords/v6/puzzle/midi/${date}.json`, HEADERS.nytBypass);

  // Oracle
  results.a9_oracle_daily = await fetchWithHeaders('https://www.nytimes.com/svc/crosswords/v2/oracle/daily.json', HEADERS.nytBypass);
  results.a10_oracle_mini = await fetchWithHeaders('https://www.nytimes.com/svc/crosswords/v2/oracle/mini.json', HEADERS.nytBypass);

  return results;
}

// ============ WAPO (verify) ============
async function testWaPo(date) {
  const [y, m, d] = date.split('-');
  const results = {};
  results.a1_daily = await fetchWithHeaders(`https://games-service-prod.site.aws.wapo.pub/crossword/levels/daily/${y}/${m}/${d}`, HEADERS.chromeJson);
  results.a2_mini = await fetchWithHeaders(`https://games-service-prod.site.aws.wapo.pub/crossword/levels/mini/${y}/${m}/${d}`, HEADERS.chromeJson);

  const sun = new Date(date);
  sun.setDate(sun.getDate() - sun.getDay());
  const [sy, sm, sd] = sun.toISOString().slice(0, 10).split('-');
  results.a3_sunday = await fetchWithHeaders(`https://games-service-prod.site.aws.wapo.pub/crossword/levels/sunday/${sy}/${sm}/${sd}`, HEADERS.chromeJson);

  // Check data
  for (const key of ['a1_daily', 'a2_mini', 'a3_sunday']) {
    if (results[key]?.status === 200 && results[key]?.body) {
      try {
        const j = JSON.parse(results[key].body);
        results[key + '_data'] = { hasAnswers: j.cells?.some(c => c.answer), clueCount: j.words?.length };
      } catch(e) {}
    }
  }

  // Future
  const tom = new Date(date);
  tom.setDate(tom.getDate() + 1);
  const [ty, tm2, td] = tom.toISOString().slice(0, 10).split('-');
  results.a4_future = await fetchWithHeaders(`https://games-service-prod.site.aws.wapo.pub/crossword/levels/daily/${ty}/${tm2}/${td}`, HEADERS.chromeJson);

  return results;
}

// ============ MAIN ============
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const date = url.searchParams.get('date') || '2026-05-25';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
    }

    let results;
    try {
      switch (path) {
        case '/': return new Response(JSON.stringify({
          service: 'Crossword Source Test Worker',
          endpoints: [
            '/test/latimes-mini', '/test/usa-today-quick', '/test/new-yorker',
            '/test/guardian-quick', '/test/guardian-cryptic', '/test/guardian-prize',
            '/test/guardian-everyman', '/test/guardian-speedy', '/test/guardian-quiptic',
            '/test/guardian-weekend', '/test/newsday', '/test/universal',
            '/test/puzzmo', '/test/vox', '/test/daily-pop',
            '/test/atlantic', '/test/nyt', '/test/wapo', '/test/all',
          ],
          usage: '?date=YYYY-MM-DD (default: 2026-05-25)',
        }, null, 2), { headers: { 'Content-Type': 'application/json' } });

        case '/test/latimes-mini': results = await testLATimesMini(date); break;
        case '/test/usa-today-quick': results = await testUSATodayQuick(date); break;
        case '/test/new-yorker': results = await testNewYorker(date); break;
        case '/test/guardian-quick': results = await testGuardian(date, 'quick'); break;
        case '/test/guardian-cryptic': results = await testGuardian(date, 'cryptic'); break;
        case '/test/guardian-prize': results = await testGuardian(date, 'prize'); break;
        case '/test/guardian-everyman': results = await testGuardian(date, 'everyman'); break;
        case '/test/guardian-speedy': results = await testGuardian(date, 'speedy'); break;
        case '/test/guardian-quiptic': results = await testGuardian(date, 'quiptic'); break;
        case '/test/guardian-weekend': results = await testGuardian(date, 'weekend-crossword'); break;
        case '/test/newsday': results = await testNewsday(date); break;
        case '/test/universal': results = await testUniversal(date); break;
        case '/test/puzzmo': results = await testPuzzmo(date); break;
        case '/test/vox': results = await testVox(date); break;
        case '/test/daily-pop': results = await testDailyPop(date); break;
        case '/test/atlantic': results = await testAtlantic(date); break;
        case '/test/nyt': results = await testNYT(date); break;
        case '/test/wapo': results = await testWaPo(date); break;

        case '/test/all':
          const [latMini, usaQuick, newYorker, guardianQuick, newsday, universal, puzzmo, vox, dailyPop, atlantic, nyt, wapo] = await Promise.all([
            testLATimesMini(date), testUSATodayQuick(date), testNewYorker(date),
            testGuardian(date, 'quick'), testNewsday(date), testUniversal(date),
            testPuzzmo(date), testVox(date), testDailyPop(date),
            testAtlantic(date), testNYT(date), testWaPo(date),
          ]);
          results = { latimes_mini: latMini, usa_today_quick: usaQuick, new_yorker: newYorker, guardian_quick: guardianQuick, newsday, universal, puzzmo, vox, daily_pop: dailyPop, atlantic, nyt, wapo };
          break;

        default: return new Response('Not found. Try /', { status: 404 });
      }
    } catch (e) {
      results = { error: e.message, stack: e.stack?.split('\n').slice(0, 3) };
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  },
};
