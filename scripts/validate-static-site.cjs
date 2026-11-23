const { fs, path, readArray, imagePattern, read, dirs } = require('./site-common.cjs');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { attr, children, documentHTML, elements, hasClass, hasRel, jsonLD, text } = require('./site-html.cjs');
const { styles, scripts } = require('./site-preflight.cjs');

const assert = (value, message) => { if (!value) throw Error(message); };
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function validate(root, overlay = new Map()) {
  const load = name => overlay.has(name) ? overlay.get(name) : read(path.join(root, name));
  const listings = new Map();
  function leaf(name) {
    if (name === '.static-site-build.lock') return false;
    if (overlay.has(name)) return true;
    let current = root;
    for (const part of name.split('/')) {
      if (!part || part === '.' || part === '..') return false;
      if (!listings.has(current)) {
        const stat = fs.lstatSync(current, { throwIfNoEntry: false });
        listings.set(current, stat?.isDirectory() ? new Set(fs.readdirSync(current)) : new Set());
      }
      if (!listings.get(current).has(part)) return false;
      current = path.join(current, part);
    }
    return fs.lstatSync(current, { throwIfNoEntry: false })?.isFile();
  }
  const pages = new Map();
  function page(name) {
    if (!pages.has(name)) pages.set(name, inspectPage(load(name), name));
    return pages.get(name);
  }
  const home = page('index.html'), site = home.canonical;
  const siteURL = new URL(site);
  const robotsSitemaps = [...load('robots.txt').matchAll(/^\s*Sitemap\s*:\s*(\S+)\s*$/gim)].map(match => match[1]);
  assert(robotsSitemaps.includes(new URL('sitemap.xml', site).href), 'robots.txt: add the Sitemap URL for the home canonical.');

  const xml = load('sitemap.xml');
  assert(XMLValidator.validate(xml) === true, 'sitemap.xml: invalid XML.');
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml), nodes = [].concat(parsed.urlset?.url || []);
  const locations = nodes.map(node => node.loc);
  assert(new Set(locations).size === locations.length, 'sitemap.xml: duplicate URLs.');
  const diaries = readArray(load('database.js'), 'DIARY_FILES');
  assert(diaries.every(x => typeof x === 'string' && /^\d{6}\.html$/.test(x)), 'database.js: invalid diary filename.');
  const diskDiaries = dirs(path.join(root, 'database')).filter(entry => entry.isFile() && /^\d{6}\.html$/.test(entry.name)).map(entry => entry.name).sort();
  assert(diaries.join() === diskDiaries.join(), 'database.js: diary manifest differs from database/.');
  const ids = diaries.map(name => `daily-${name.slice(0, 6)}`).reverse();
  const sectors = readArray(load('pictures.js'), 'PICTURE_SECTORS');
  assert(same(sectors.map(sector => sector.id), dirs(path.join(root, 'media')).filter(entry => entry.isDirectory()).map(entry => entry.name)), 'pictures.js: photo manifest differs from media/ sectors.');
  const expected = new Map([['index.html', { posts: ids.slice(0, 8) }], ['archive.html', { posts: ids, all: 'true' }]]);
  for (const name of diaries) expected.set(`database/${name}`, { diary: name.slice(0, 6), posts: [`daily-${name.slice(0, 6)}`] });
  const imageURLs = new Map();
  const galleries = sectors.map((sector, i) => i ? `pictures/${sector.id}.html` : 'pictures.html');
  sectors.forEach((sector, index) => {
    const gallery = galleries[index];
    expected.set(gallery, { sector: sector.id });
    const photos = dirs(path.join(root, 'media', sector.id)).filter(entry => entry.isFile() && imagePattern.test(entry.name)).map(entry => entry.name);
    assert(same(sector.files, photos), `pictures.js: photo list differs from media/${sector.id}/.`);
    assert(same(sector.thumbnails || [], photos), `pictures.js: thumbnail list differs from media/${sector.id}/.`);
    const view = page(gallery).view;
    const navigation = elements(view, node => node.tagName === 'nav' && hasClass(node, 'picture-sector-nav'));
    assert(navigation.length === 1 && children(navigation[0]).map(node => node.tagName === 'a' && attr(node, 'href')).join() === galleries.map(name => `./${name}`).join(), `${gallery}: gallery navigation must link to each current sector in order.`);
    const grid = children(view).find(node => hasClass(node, 'picture-grid'));
    const tiles = children(grid);
    assert(grid && tiles.length === photos.length, `${gallery}: missing picture grid or incorrect photo count.`);
    for (const [index, photo] of sector.files.entries()) {
      const src = `./media/${sector.id}/${encodeURIComponent(photo)}`;
      const preview = `./thumbnails/${sector.id}/${encodeURIComponent(photo)}.webp`;
      const image = children(tiles[index]).find(node => node.tagName === 'img');
      assert(tiles[index].tagName === 'a' && hasClass(tiles[index], 'picture-tile') && attr(tiles[index], 'href') === src && attr(image, 'src') === preview && attr(image, 'alt') === (sector.descriptions?.[photo] || ''), `${gallery}: incorrect tile, thumbnail or description for ${photo}.`);
    }
    imageURLs.set(gallery, sector.files.filter(photo => !/\.heic$/i.test(photo)).map(photo => `${site}media/${sector.id}/${encodeURIComponent(photo)}`));
  });
  assert(same(locations, [...expected.keys()].map(name => name === 'index.html' ? site : site + name)), 'sitemap.xml: URLs differ from the current pages.');
  if (fs.existsSync(path.join(root, 'pictures'))) for (const entry of dirs(path.join(root, 'pictures'))) {
    if (entry.isFile() && /\.html$/i.test(entry.name)) assert(expected.has(`pictures/${entry.name}`), `Obsolete gallery: pictures/${entry.name}. Review and remove or move the old page, then rerun the build.`);
  }

  const titles = new Set(), idsByPage = new Map(), linkErrors = new Set();
  let checkedLinks = 0, imageCount = 0;
  for (const node of nodes) {
    const name = decodeURIComponent(node.loc.slice(site.length)) || 'index.html';
    assert(leaf(name), `Missing page: ${name}`);
    const { body, base, head, view, dom, title, canonical } = page(name);
    const state = expected.get(name);
    const meta = (attribute, value) => children(head).filter(element => element.tagName === 'meta' && attr(element, attribute)?.toLowerCase() === value);
    assert(canonical === node.loc && attr(meta('property', 'og:url')[0], 'content') === node.loc && meta('property', 'og:url').length === 1, `${name}: wrong canonical or sharing URL.`);
    assert(meta('name', 'robots').length === 1 && attr(meta('name', 'robots')[0], 'content') === 'index, follow, max-image-preview:large', `${name}: invalid robots metadata.`);
    assert(title && !titles.has(title), `${name}: empty or duplicate title.`);
    titles.add(title);
    assert(base === (name.includes('/') ? '../' : undefined), `${name}: incorrect <base> for the page directory.`);
    assert(attr(body, 'data-diary-id') === state.diary && attr(body, 'data-all-entries') === state.all &&
      attr(body, 'data-picture-sector') === state.sector && attr(body, 'data-initial-view') === (state.sector ? 'picture' : undefined), `${name}: incorrect body state for the page type.`);
    assert(hasClass(view, state.sector ? 'picture-view' : 'feed-view'), `${name}: incorrect initial view.`);
    const posts = children(view).filter(element => element.tagName === 'article' && hasClass(element, 'diary-post'));
    assert(posts.map(post => attr(post, 'id')).join() === (state.posts || []).join() && posts.every(post => children(post).filter(element => hasClass(element, 'post-content')).length === 1), `${name}: missing, malformed or misordered static diary posts.`);
    const structured = children(head).filter(element => element.tagName === 'script' && attr(element, 'type') === 'application/ld+json');
    assert(structured.length === 1, `${name}: expected one JSON-LD script.`);
    const graph = jsonLD(structured[0], name)?.['@graph'];
    assert(Array.isArray(graph) && graph.some(item => item?.['@type'] === 'WebSite' && item.url === site) && graph.some(item => item?.['@type'] === 'Person'), `${name}: invalid shared JSON-LD graph.`);
    const articles = graph.filter(item => item?.['@type'] === 'BlogPosting');
    const collections = graph.filter(item => item?.['@type'] === 'CollectionPage');
    assert(state.diary ? articles.length === 1 && articles[0].mainEntityOfPage === node.loc : !articles.length, `${name}: incorrect BlogPosting data.`);
    assert(state.sector ? collections.length === 1 && collections[0].url === node.loc : !collections.length, `${name}: incorrect CollectionPage data.`);

    const images = [].concat(node['image:image'] || []).map(image => image['image:loc']);
    assert(same(images, imageURLs.get(name) || []), `${name}: image sitemap disagrees with gallery files.`);
    imageCount += images.length;
    const baseURL = new URL(base || node.loc, node.loc);
    const links = elements(dom, element => attr(element, 'href') !== undefined || attr(element, 'src') !== undefined);
    for (const element of links) {
      if (element.tagName === 'base') continue;
      for (const attribute of ['href', 'src']) {
        const href = attr(element, attribute);
        if (href === undefined) continue;
        try {
          assert(href.trim(), `empty ${attribute}`);
          assert(!/^\.\/(?:archive\.html)?#daily-/i.test(href), 'use the direct diary URL');
          const target = new URL(href, baseURL);
          assert(!['javascript:', 'vbscript:'].includes(target.protocol), 'unsupported link scheme');
          if (!['http:', 'https:'].includes(target.protocol) || target.origin !== siteURL.origin || !target.pathname.startsWith(siteURL.pathname)) {
            assert(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href), 'relative path leaves the site');
            continue;
          }
          let local = decodeURIComponent(target.pathname.slice(siteURL.pathname.length));
          // A GitHub Pages user site can link to a separately deployed project.
          if (siteURL.hostname.endsWith('.github.io') && siteURL.pathname === '/' && /^https?:\/\//i.test(href) &&
              /^[A-Za-z0-9_-]+\//.test(local) && !listings.get(root)?.has(local.split('/')[0])) continue;
          if (!local || local.endsWith('/')) local += 'index.html';
          assert(leaf(local), 'target missing or path case differs');
          if (target.hash && expected.has(local)) {
            if (!idsByPage.has(local)) idsByPage.set(local, new Set(elements(page(local).dom, item => attr(item, 'id') !== undefined || (item.tagName === 'a' && attr(item, 'name') !== undefined)).flatMap(item => [attr(item, 'id'), attr(item, 'name')])));
            assert(idsByPage.get(local).has(decodeURIComponent(target.hash.slice(1))) || target.hash === '#top' || target.hash.startsWith('#:~:text='), 'fragment target missing');
          }
          checkedLinks++;
        } catch (error) {
          linkErrors.add(`${name}:${element.sourceCodeLocation?.startLine || '?'} -> ${href} (${error.message})`);
        }
      }
    }
  }
  assert(!linkErrors.size, `Broken link(s). Fix the source URL or restore its target:\n${[...linkErrors].map(error => `  - ${error}`).join('\n')}`);
  console.log(`PASS: ${locations.length} pages, ${diaries.length} diaries, ${imageCount} sitemap images and ${checkedLinks} local links.`);
}

function inspectPage(html, name) {
  const dom = documentHTML(html, name);
  const htmlNode = children(dom).find(node => node.tagName === 'html');
  const [head, body] = children(htmlNode);
  const canonicals = children(head).filter(node => node.tagName === 'link' && hasRel(node, 'canonical'));
  const titles = children(head).filter(node => node.tagName === 'title');
  const bases = children(head).filter(node => node.tagName === 'base');
  assert(attr(htmlNode, 'lang') === 'ko' && canonicals.length === 1 && attr(canonicals[0], 'href') && titles.length === 1 && bases.length <= 1, `${name}: expected lang=ko, one canonical, one title and at most one base.`);
  const stylesheets = children(head).filter(node => node.tagName === 'link' && hasRel(node, 'stylesheet')).map(node => attr(node, 'href'));
  assert(styles.every(style => stylesheets.filter(href => href === `./${style}`).length === 1) && stylesheets.indexOf('./theme.css') < stylesheets.indexOf('./style.css'), `${name}: load theme.css before style.css.`);
  const assets = children(head).filter(node => node.tagName === 'script' && attr(node, 'src'));
  const expected = [scripts[0], scripts[1], 'database.js', 'pictures.js', scripts[2]];
  assert(assets.length === expected.length && assets.every((node, index) => attr(node, 'src') === `./${expected[index]}` &&
    (attr(node, 'defer') !== undefined) === (index >= 2) && attr(node, 'async') === undefined), `${name}: incorrect script order or loading attributes.`);
  const ids = elements(dom, node => attr(node, 'id') !== undefined).map(node => attr(node, 'id'));
  assert(new Set(ids).size === ids.length, `${name}: duplicate HTML id. Use unique IDs in the page and its diary content.`);
  const app = children(body).find(node => attr(node, 'id') === 'app');
  const shell = children(app).find(node => hasClass(node, 'social-shell'));
  const main = children(shell).find(node => node.tagName === 'main' && hasClass(node, 'main-column'));
  const view = children(main).find(node => node.tagName === 'section' && hasClass(node, 'view'));
  const heading = children(children(view).find(node => hasClass(node, 'view-header'))).find(node => node.tagName === 'h1');
  assert(view && attr(view, 'aria-labelledby') === 'static-title' && attr(heading, 'id') === 'static-title' && text(heading).trim(), `${name}: expected #app > .social-shell > main > section.view with a labelled heading.`);
  return { dom, head, body, view, title: text(titles[0]).trim(), canonical: attr(canonicals[0], 'href'), base: attr(bases[0], 'href') };
}

module.exports = { validate };
