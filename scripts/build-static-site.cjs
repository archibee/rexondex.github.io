const { fs, path, readArray, imagePattern, natural, escape, read, dirs, parseDiary } = require('./site-common.cjs');
const { spawnSync } = require('node:child_process');
const { validate } = require('./validate-static-site.cjs');
const { homeTemplate } = require('./site-html.cjs');
const { preflight } = require('./site-preflight.cjs');
const { changes, commit, outputPath, withBuildLock } = require('./site-output.cjs');
const { planThumbnails } = require('./generate-thumbnails.cjs');
function fail(message) { throw Error(message); }
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function readPhotoDescriptions(root) {
  const source = outputPath(root, 'pictures.js');
  if (!fs.existsSync(source)) {
    console.warn('[WARN] pictures.js is missing. Any previous photo descriptions can be recovered from a known-good copy before rebuilding.');
    return new Map();
  }
  try {
    const result = new Map();
    for (const sector of readArray(read(source), 'PICTURE_SECTORS')) {
      if (!isObject(sector) || !/^[a-zA-Z0-9-]+$/.test(sector.id) || typeof sector.id !== 'string' || result.has(sector.id)) fail('Invalid or duplicate sector ID.');
      const descriptions = Object.hasOwn(sector, 'descriptions') ? sector.descriptions : {};
      if (!isObject(descriptions) || Object.values(descriptions).some(value => typeof value !== 'string')) fail(`${sector.id}: descriptions must map filenames to text.`);
      result.set(sector.id, descriptions);
    }
    return result;
  } catch (error) { fail(`pictures.js: ${error.message} Restore or correct the photo description data before rebuilding.`); }
}

function readPhotoOrder(root) {
  const source = outputPath(root, 'picture-order.json');
  if (!fs.existsSync(source)) return new Map();
  try {
    const value = JSON.parse(read(source));
    if (!isObject(value)) fail('Expected an object with one filename array per sector.');
    for (const [sector, names] of Object.entries(value)) {
      if (!/^[a-zA-Z0-9-]+$/.test(sector) || !Array.isArray(names) || new Set(names).size !== names.length ||
          names.some(name => typeof name !== 'string' || /[/\\]/.test(name) || !imagePattern.test(name))) fail(`${sector}: expected distinct photo filenames.`);
    }
    return new Map(Object.entries(value));
  } catch (error) { fail(`picture-order.json: ${error.message} Check the sector and filename lists.`); }
}

function shell(heading, body, nav) { return `<div class="social-shell">
  <header class="mobile-header"><a href="./">rexondex</a></header>
  <aside class="side-nav"><a class="wordmark" href="./"><img class="brand-logo" src="./favicon.svg" alt=""><span>rexondex</span><small>archive</small></a><nav aria-label="주요 메뉴"><a href="./">일기</a><a href="./pictures.html">사진</a></nav></aside>
  <main class="main-column"><section class="view feed-view" aria-labelledby="static-title">
    <header class="view-header"><h1 id="static-title">${heading}</h1></header>
    ${body}
    <footer class="diary-post">${nav}</footer>
  </section></main>
</div>`; }
async function build(root, check) {
  const file = name => path.join(root, name), load = name => read(file(name));
  console.log('[1/4] Checking site layout and reading sources...');
  preflight(root);
  const diaryEntries = dirs(file('database'));
  const ids = diaryEntries.filter(e => e.isFile() && /^\d{6}\.html$/.test(e.name)).map(e => e.name.slice(0, 6)).sort().reverse();
  if (!ids.length) fail('No publishable diaries found.');
  const diaryErrors = [], diaries = new Map();
  for (const id of ids) {
    const name = `database/${id}.html`;
    try { diaries.set(id, parseDiary(load(name), name, id)); }
    catch (error) { diaryErrors.push(`  - ${name}: ${error.message}`); }
  }
  if (diaryErrors.length) fail(`Diary input errors. Review the published filenames or markup:\n${diaryErrors.join('\n')}`);
  const previous = readPhotoDescriptions(root);
  const photoOrder = readPhotoOrder(root);
  const { site, graph, render } = homeTemplate(load('index.html'));
  const entries = dirs(file('media'));
  const folders = entries.filter(e => e.isDirectory()).map(e => e.name).sort(natural);
  if (!folders.length) fail('No photo sectors found.');
  const { outputs: pending, stale: thumbnails } = await planThumbnails(root, check);
  const sectors = folders.map(id => {
    const direct = dirs(file(`media/${id}`));
    const files = direct.filter(e => e.isFile() && imagePattern.test(e.name)).map(e => e.name).sort(natural).reverse();
    if (photoOrder.has(id)) {
      const ranks = new Map(photoOrder.get(id).map((name, i) => [name, i]));
      for (const name of ranks.keys()) if (!files.includes(name)) console.warn(`[WARN] picture-order.json ${id}/${name}: photo is missing or its name differs. Review this entry.`);
      files.sort((a, b) => (ranks.get(a) ?? -1) - (ranks.get(b) ?? -1));
    }
    const prior = previous.get(id) || {};
    for (const name of Object.keys(prior)) if (!files.includes(name) && prior[name]) fail(`pictures.js ${id}/${name}: photo with a description is missing. Move or remove its description after reviewing it.`);
    const descriptions = Object.fromEntries(Object.keys(prior).sort().filter(name => files.includes(name)).map(name => [name, prior[name]]));
    return { id, descriptions, files, thumbnails: [...files] };
  });
  for (const [id, descriptions] of previous) if (!folders.includes(id) && Object.values(descriptions).some(Boolean)) {
    fail(`pictures.js ${id}: sector with photo descriptions is missing. Move or remove its descriptions after reviewing them.`);
  }
  for (const id of photoOrder.keys()) if (!folders.includes(id)) console.warn(`[WARN] picture-order.json ${id}: sector is missing. Review this entry.`);
  pending.set('database.js', `// Generated from database/ by scripts/build-static-site.cjs. Add HTML files to the folder.\nwindow.DIARY_FILES = [\n${ids.slice().reverse().map(id => `  '${id}.html',`).join('\n')}\n];\n`);
  pending.set('pictures.js', `// File lists are generated from media/sector folders. Photo descriptions are preserved.\nwindow.PICTURE_SECTORS = ${JSON.stringify(sectors, null, 2)};\n`);
  function page(name, title, description, body, attributes = '', entity = null) {
    const url = name === 'index.html' ? site : site + name;
    const article = entity?.['@type'] === 'BlogPosting';
    let head = render({ title, url, meta: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      description, 'og:description': description, 'twitter:description': description, 'og:title': title,
      'twitter:title': title, 'og:url': url, 'og:type': article ? 'article' : 'website',
      robots: 'index, follow, max-image-preview:large'
    } });
    if (article) head += `\n<meta property="article:published_time" content="${entity.datePublished}">`;
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': entity ? [...graph, entity] : graph }, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    const scripts = '<script src="./legacy-links.js"></script><script src="./theme-init.js"></script><script defer src="./database.js"></script><script defer src="./pictures.js"></script><script defer src="./app.js"></script>';
    const noscript = '<noscript><p>달력과 테마 설정은 JavaScript를 활성화하면 사용할 수 있습니다. <a href="./">메인</a> · <a href="./archive.html">전체 일기</a> · <a href="./pictures.html">사진</a></p></noscript>';
    pending.set(name, `<!doctype html>\n<html lang="ko">\n<head>\n${name.includes('/') ? '<base href="../">' : ''}${head}\n<script type="application/ld+json">${json}</script>\n${scripts}\n</head>\n<body ${attributes}><div id="app">\n<!-- STATIC-ARCHIVE:START -->\n${body}\n<!-- STATIC-ARCHIVE:END -->\n</div>${noscript}</body>\n</html>\n`);
  }
  console.log('[2/4] Rendering static pages in memory...');
  const posts = ids.map((id, i) => {
    const name = `database/${id}.html`, d = diaries.get(id), reference = d.references === null ? '' : `<div class="post-references" aria-label="참고 링크">${d.references}</div>`;
    const post = `<article class="diary-post" id="daily-${id}" aria-label="${escape(d.longLabel)}">\n  <header><img class="post-avatar" src="./rexondex.jpg" alt="" width="44" height="44"><div><strong>rexondex</strong><time datetime="${d.iso}">${escape(d.longLabel)}</time></div></header>\n  ${reference}\n  <div class="post-content">${d.content}</div>\n  <footer><a class="post-permalink" href="./${name}">${id} &#183; &#47553;&#53356;</a></footer>\n</article>`;
    let nav = '<a href="./">메인</a> · <a href="./archive.html">전체 일기</a>';
    if (i > 0) nav += ` · <a href="./database/${ids[i-1]}.html">다음 일기</a>`;
    if (i < ids.length-1) nav += ` · <a href="./database/${ids[i+1]}.html">이전 일기</a>`;
    const entity = { '@type': 'BlogPosting', '@id': `${site}${name}#article`, headline: `${d.label} 일기`, description: d.description, datePublished: d.iso, inLanguage: 'ko', author: { '@id': `${site}#author` }, mainEntityOfPage: site + name };
    page(name, `${d.label} 일기 | rexondex Archive`, d.description, shell(`${d.label} 일기`, post, nav), `data-diary-id="${id}"`, entity); return post;
  });
  page('index.html', 'rexondex Archive', 'rexondex의 일기와 사진을 모은 개인 디지털 아카이브입니다. 일상의 기록과 참고 링크를 달력으로 탐색할 수 있습니다.', shell('일기', posts.slice(0,8).join('\n'), '<a href="./archive.html">전체 일기 보기</a> · <a href="./pictures.html">사진 보기</a>'));
  page('archive.html', '전체 일기 | rexondex Archive', 'rexondex의 전체 일기를 최신 날짜순으로 읽고, 각 날짜의 일기와 참고 링크를 찾아볼 수 있습니다.', shell('전체 일기', posts.join('\n'), '<a href="./">일기장으로 돌아가기</a>'), 'data-all-entries="true"');
  const urls = [`<url><loc>${site}</loc></url>`, `<url><loc>${site}archive.html</loc></url>`, ...ids.map(id => `<url><loc>${site}database/${id}.html</loc></url>`)];
  sectors.forEach((sector, i) => {
    const name = i ? `pictures/${sector.id}.html` : 'pictures.html';
    const navigation = sectors.map((s, j) => `<a href="${j ? `./pictures/${s.id}.html` : './pictures.html'}">${escape(s.id)}</a>`).join('');
    const images = sector.files.map(f => {
      const src = `./media/${sector.id}/${encodeURIComponent(f)}`, thumb = sector.thumbnails.includes(f) ? `./thumbnails/${sector.id}/${encodeURIComponent(f)}.webp` : src, alt = escape(sector.descriptions[f] || ''), label = alt || escape(`${sector.id}/${f} 사진 크게 보기`);
      return `<a class="picture-tile" href="${src}" aria-label="${label}"><img src="${thumb}" alt="${alt}" decoding="async"></a>`;
    });
    const content = `<div class="picture-toolbar"><nav class="picture-sector-nav" aria-label="사진 섹터">${navigation}</nav></div><div class="picture-grid">${images.join('\n')}</div>`;
    const entity = { '@type':'CollectionPage', name:`rexondex 사진 ${sector.id}`, url:site+name, inLanguage:'ko' };
    page(name, `사진 ${sector.id} | rexondex Archive`, `rexondex의 ${sector.id} 사진 아카이브입니다. ${sector.files.length}장의 사진을 둘러보고 원본을 열어볼 수 있습니다.`, shell('사진', content, '<a href="./">일기장으로 돌아가기</a>').replace('view feed-view','view picture-view'), `data-initial-view="picture" data-picture-sector="${sector.id}"`, entity);
    urls.push(`<url><loc>${site}${name}</loc>${sector.files.filter(f => !/\.heic$/i.test(f)).map(f => `<image:image><image:loc>${site}media/${sector.id}/${encodeURIComponent(f)}</image:loc></image:image>`).join('')}</url>`);
  });
  pending.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
  console.log('[3/4] Checking pages, manifests, local links and browser logic...');
  validate(root, pending);
  const runtime = spawnSync(process.execPath, [path.join(__dirname, 'test-runtime.cjs'), root], { encoding: 'utf8', timeout: 15000 });
  if (runtime.error) fail(`app.js runtime checks could not finish: ${runtime.error.message}`);
  if (runtime.status !== 0) fail(`app.js runtime checks failed. Review the failing test below.\n${runtime.stdout}${runtime.stderr}`);
  console.log('PASS: app.js runtime regression tests.');
  const changed = changes(root, pending);
  if (check) {
    const thumbnailStatus = thumbnails.size ? ` ${thumbnails.size} thumbnail(s) are missing or out of date.` : '';
    if (changed.length) fail(`Generated output is out of date.${thumbnailStatus} Run the builder without --check.\n${changed.map(({ name }) => `  - ${name}${thumbnails.has(name) ? ` (${thumbnails.get(name)})` : ''}`).join('\n')}`);
    console.log('[4/4] PASS: generated files are current; no files changed.');
  } else {
    console.log('[4/4] Saving validated outputs with rollback protection...');
    commit(changed);
    for (const { name } of changed) console.log(`[UPDATED] ${name}${thumbnails.has(name) ? ` (${thumbnails.get(name)})` : ''}`);
    console.log(`PASS: ${changed.length} output(s) updated. ${ids.length} diaries and ${sectors.length} galleries.`);
  }
}

async function main(args) {
  let root = path.join(__dirname, '..'), check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--site-root' && args[i + 1] && !args[i + 1].startsWith('--')) root = args[++i];
    else fail(`Unknown or incomplete argument '${args[i]}'. Usage: node scripts/build-static-site.cjs [--check] [--site-root PATH]`);
  }
  const siteRoot = fs.realpathSync(root);
  await withBuildLock(siteRoot, check, () => build(siteRoot, check));
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
