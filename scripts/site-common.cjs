const fs = require('node:fs');
const path = require('node:path');
const { decodeHTML, escapeAttribute } = require('entities');
const { readArray } = require('./manifest.cjs');
const { parse, parseFragment } = require('parse5');
const { attr, elements, hasClass } = require('./site-html.cjs');
const imagePattern = /\.(?:jpe?g|png|webp|gif|avif|heic)$/i;
const imageLike = /\.(?:jpe?g|png|webp|gif|avif|heic|bmp|svg|tiff?|ico|jfif|apng)$/i;
const natural = (a, b) => a.replace(/\d+/g, n => n.padStart(30, '0')).localeCompare(b.replace(/\d+/g, n => n.padStart(30, '0')), 'en');
const escape = value => escapeAttribute(String(value));
const exists = p => fs.existsSync(p);
const read = p => fs.readFileSync(p, 'utf8');
const dirs = p => fs.readdirSync(p, { withFileTypes: true });
function diaryDate(id) {
  const date = new Date(Date.UTC(2000 + +id.slice(0, 2), +id.slice(2, 4) - 1, +id.slice(4, 6)));
  if (date.toISOString().slice(0, 10).replace(/-/g, '') !== '20' + id) throw Error(`Invalid diary date in '${id}.html'.`);
  return date;
}
function section(html, tree, name) {
  const matches = elements(tree, node => node.tagName === 'div' && hasClass(node, name));
  if (matches.length > 1) throw Error(`Diary has multiple .${name} sections.`);
  if (!matches.length) return null;
  const location = matches[0].sourceCodeLocation;
  if (!location?.endTag) throw Error(`Unclosed ${name} div.`);
  return html.slice(location.startTag.endOffset, location.endTag.startOffset);
}
const markup = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][a-z0-9:-]*(?=[\t\n\f\r />])(?:"[^"]*"|'[^']*'|[^"'<>])*?>/gi;
const allowed = new Set('a abbr article aside b blockquote br cite code dd del div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img kbd li mark ol p pre q rp rt ruby s samp section small span strong sub sup table tbody td th thead time tr u ul var wbr'.split(' '));
const voids = new Set('br hr img wbr'.split(' '));
function assertMarkup(html, file) {
  const stack = [];
  let explicit = 0;
  for (const [tag] of html.matchAll(markup)) {
    if (/^<!/.test(tag)) continue;
    const m = /^<\s*(\/)?\s*([a-z][a-z0-9:-]*)/i.exec(tag), name = m[2].toLowerCase();
    if (!allowed.has(name)) throw Error(`Diary '${file}' has unsupported <${name}>.`);
    if (m[1]) { if (voids.has(name) || stack.pop() !== name) throw Error(`Mismatched </${name}> in diary '${file}'.`); }
    else {
      explicit++;
      if (!voids.has(name)) stack.push(name);
    }
  }
  if (stack.length) throw Error(`Unclosed <${stack.at(-1)}> in diary '${file}'.`);
  if (!explicit) return;
  const errors = [];
  const tree = parseFragment(html, { sourceCodeLocationInfo: true, onParseError: error => errors.push(error) });
  const parsed = elements(tree, node => Boolean(node.sourceCodeLocation?.startTag));
  if (errors.length || parsed.length !== explicit || parsed.some(node => !voids.has(node.tagName) && !node.sourceCodeLocation.endTag)) {
    throw Error(`Invalid HTML nesting in diary '${file}'. Check that the browser can keep the authored structure, including nested links, paragraphs and tables.`);
  }
  for (const node of parsed) {
    if (node.attrs.some(({ name }) => /^on[a-z]/i.test(name) || name === 'style' || name === 'srcdoc')) throw Error(`Unsafe attribute in diary '${file}'.`);
    for (const name of ['href', 'src']) {
      const value = attr(node, name)?.replace(/[\t\n\r]/g, '').trim();
      if (/^(?:javascript|vbscript):/i.test(value || '')) throw Error(`Unsafe URL in diary '${file}'.`);
    }
    if ((node.tagName === 'a' && !attr(node, 'href')?.trim()) || (node.tagName === 'img' && !attr(node, 'src')?.trim())) {
      throw Error(`Missing href/src in diary '${file}'.`);
    }
  }
}
function links(content) {
  const found = [];
  content = content.replace(/\[\[(?:(https?:\/\/[^\]\s]+)|링크\|(https?:\/\/[^|\]\s]+)(?:\|([^\]\r\n]+))?)\]\]/g, (_, bare, url, label) => {
    const href = escape(bare || url); found.push(`<a class="post-reference" href="${href}">${label ? escape(label) : bare ? href : '링크'}</a>`); return '';
  }).replace(/<p>\s*<\/p>/gi, '');
  if (content.includes('[[')) throw Error('Unrecognized [[ link marker.');
  return { content, found };
}
function parseDiary(html, file, id) {
  const tags = [...html.matchAll(markup)].map(([tag]) => tag);
  const full = tags.some(tag => /^<(?:html|head|body)(?:\s|>)|^<!doctype\b/i.test(tag));
  const tree = (full ? parse : parseFragment)(html, { sourceCodeLocationInfo: true });
  let content = section(html, tree, 'post-content'), references = section(html, tree, 'post-references');
  if (full && content === null) throw Error(`Diary '${file}' has no .post-content section.`);
  if (full) for (const tag of ['html', 'head', 'body']) {
    const starts = tags.filter(source => new RegExp(`^<${tag}(?:\\s|>)`, 'i').test(source));
    const ends = tags.filter(source => new RegExp(`^</${tag}\\s*>$`, 'i').test(source));
    if (starts.length !== 1 || ends.length !== 1) throw Error(`Incomplete <${tag}> in '${file}'.`);
  }
  content ??= html.trim();
  if ([content, references || ''].some(section => [...section.matchAll(markup)].some(([tag]) => !tag.startsWith('<!') && tag.includes('[[')))) {
    throw Error(`Link marker inside tag in '${file}'. Place [[https://address]] in the visible text.`);
  }
  assertMarkup(content, file); if (references !== null) assertMarkup(references, file);
  const parsed = links(content); content = parsed.content;
  if (!/<[a-z][^>]*>/i.test(content)) content = content.trim().split(/\r?\n[\t ]*\r?\n+/).filter(x => x.trim()).map(p => `<p>${p.split(/\r?\n/).map(x => escape(x.trim())).join('<br>')}</p>`).join('\n');
  if (references !== null) { const r = links(references); references = r.content + r.found.join(''); }
  if (parsed.found.length) references = (references || '') + parsed.found.join('');
  if (!content.trim()) throw Error(`Diary '${file}' has an empty body.`);
  const date = diaryDate(id), year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
  const iso = date.toISOString().slice(0, 10), label = `${year}년 ${month}월 ${day}일`, longLabel = `${label} ${['일','월','화','수','목','금','토'][date.getUTCDay()]}요일`;
  content = content.replace(/^\s*<p>\s*\d{2}\.\d{2}\.\d{2}\s*<\/p>/, `<p>${id.slice(0,2)}.${id.slice(2,4)}.${id.slice(4,6)}</p>`);
  let summary = decodeHTML(content.replace(markup, ' ')).replace(/\s+/g, ' ').trim().replace(/^\d{2}\.\d{2}\.\d{2}\s*/, '');
  if (summary.length > 150) summary = summary.slice(0, 150) + '…';
  return { id, content, references, iso, label, longLabel, description: `${label} 일기. ${summary}` };
}
module.exports = { fs, path, decodeHTML, readArray, imagePattern, imageLike, natural, escape, exists, read, dirs, diaryDate, parseDiary };
