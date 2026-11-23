const { parse } = require('parse5');
const { escapeText, escapeAttribute } = require('entities');

const children = node => (node?.childNodes || []).filter(child => child.tagName);
const attr = (node, name) => node?.attrs?.find(item => item.name === name)?.value;
const tokens = value => (value || '').split(/[\t\n\f\r ]+/).filter(Boolean);
const hasClass = (node, name) => tokens(attr(node, 'class')).includes(name);
const hasRel = (node, name) => tokens(attr(node, 'rel')?.toLowerCase()).includes(name);
const text = node => node?.value ?? (node?.childNodes || []).map(text).join('');
function elements(node, predicate) {
  return children(node).flatMap(child => [
    ...(predicate(child) ? [child] : []),
    ...elements(child, predicate)
  ]);
}

function documentHTML(html, file) {
  const errors = [];
  const document = parse(html, { scriptingEnabled: false, sourceCodeLocationInfo: true, onParseError: error => errors.push(error) });
  if (errors.length) {
    const { code, startLine, startCol } = errors[0];
    throw Error(`${file}:${startLine}:${startCol} invalid HTML (${code}). Check the markup at this location.`);
  }
  for (const tag of ['html', 'head', 'body']) {
    const node = elements(document, element => element.tagName === tag)[0];
    if (!node?.sourceCodeLocation?.endTag) throw Error(`${file}: missing explicit <${tag}> or </${tag}>.`);
  }
  return document;
}

function jsonLD(node, file) {
  try { return JSON.parse(text(node)); }
  catch (error) { throw Error(`${file}: invalid JSON-LD. ${error.message}`); }
}

function homeTemplate(html) {
  // The head is authored input. The generated body may be damaged and is replaceable.
  const head = elements(parse(html, { sourceCodeLocationInfo: true, scriptingEnabled: false }), node => node.tagName === 'head')[0];
  const location = head?.sourceCodeLocation;
  if (!location?.endTag) throw Error('index.html: restore the complete <head> from a known-good copy.');
  const headOnly = `<!doctype html><html>${html.slice(location.startOffset, location.endOffset)}<body></body></html>`;
  const cleanHead = elements(documentHTML(headOnly, 'index.html <head>'), node => node.tagName === 'head')[0];
  if (children(cleanHead.parentNode).find(node => node.tagName === 'body').childNodes.length) {
    throw Error('index.html: unexpected content in <head>. Keep page content in <body>.');
  }
  const tags = children(head);
  const one = (label, predicate) => {
    const matches = tags.filter(predicate);
    if (matches.length !== 1) throw Error(`index.html: expected one ${label} in <head>. Restore the shared metadata.`);
    return matches[0];
  };
  const canonical = one('canonical link', node => node.tagName === 'link' && hasRel(node, 'canonical'));
  const site = attr(canonical, 'href');
  const url = URL.canParse(site || '') ? new URL(site) : null;
  if (url?.protocol !== 'https:' || !site.endsWith('/') || url.search || url.hash || url.username || url.password || url.href !== site) {
    throw Error('index.html: canonical must be an absolute HTTPS URL ending in /, with no query or fragment.');
  }
  const title = one('<title>', node => node.tagName === 'title');
  const fields = new Map();
  for (const [type, names] of [['name', ['description', 'robots', 'viewport', 'twitter:title', 'twitter:description']], ['property', ['og:title', 'og:description', 'og:url', 'og:type']]]) {
    for (const name of names) {
      const node = one(`${name} meta tag`, node => node.tagName === 'meta' && attr(node, type)?.toLowerCase() === name);
      if (!attr(node, 'content')?.trim()) throw Error(`index.html: missing content in ${name} meta tag.`);
      fields.set(name, node);
    }
  }
  const structured = one('JSON-LD script', node => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json');
  const graph = jsonLD(structured, 'index.html')?.['@graph'];
  if (!Array.isArray(graph) || !['WebSite', 'Person'].every(type => graph.some(item => item?.['@type'] === type)) ||
      graph.some(item => !item || typeof item !== 'object' || ['BlogPosting', 'CollectionPage'].includes(item['@type']))) {
    throw Error('index.html: JSON-LD @graph must contain the shared WebSite and Person data. Restore it from a known-good copy.');
  }
  // Slice the original so unmodified metadata retains its spelling and layout.
  const offset = location.startTag.endOffset;
  const slice = (start, end) => html.slice(start, end).replace(/\r\n/g, '\n');
  function render(values) {
    const edits = new Map([[title, ['text', values.title]], [canonical, ['href', values.url]]]);
    for (const [key, value] of Object.entries(values.meta)) edits.set(fields.get(key), ['content', value]);
    let result = '', cursor = offset;
    for (const node of tags) {
      const { startOffset, endOffset, startTag, endTag } = node.sourceCodeLocation;
      const original = slice(startOffset, endOffset);
      if (node.tagName === 'script' || node.tagName === 'base' || edits.has(node)) {
        result += slice(cursor, startOffset);
        if (edits.has(node)) {
          const [name, value] = edits.get(node);
          if (name === 'text') {
            result += text(node) === value ? original : slice(startOffset, startTag.endOffset) + escapeText(value) + slice(endTag.startOffset, endOffset);
          } else if (attr(node, name) === value) result += original;
          else {
            const valueLocation = node.sourceCodeLocation.attrs[name];
            const attribute = slice(valueLocation.startOffset, valueLocation.endOffset);
            const prefix = /^([^=]+=[\t\n\f\r ]*)/.exec(attribute)?.[1] || `${name}=`;
            result += slice(startOffset, valueLocation.startOffset) + `${prefix}"${escapeAttribute(value)}"` + slice(valueLocation.endOffset, endOffset);
          }
        } else result = result.trimEnd();
        cursor = endOffset;
      }
    }
    return (result + slice(cursor, location.endTag.startOffset)).trim();
  }
  return { site, graph, render };
}

// Drop indent-only text only in the builder's structural containers. Preserve
// article text (including spaces between inline nodes), CSS and script text.
const layoutTags = new Set(['html', 'head', 'body']);
function jsonShape(value) {
  if (Array.isArray(value)) return value.map(jsonShape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, jsonShape(value[key])]));
  return value;
}

function htmlShape(node, inContent = false) {
  if (node.nodeName === '#text') return ['text', node.value];
  if (node.nodeName === '#comment') return ['comment', node.data];
  if (node.nodeName === '#documentType') return ['doctype', node.name, node.publicId, node.systemId];
  inContent ||= hasClass(node, 'post-content') || hasClass(node, 'post-references');
  const layout = !inContent && (layoutTags.has(node.tagName) || attr(node, 'id') === 'app' ||
    ['social-shell', 'main-column', 'view', 'picture-grid'].some(name => hasClass(node, name)) ||
    (node.tagName === 'article' && hasClass(node, 'diary-post')));
  const nodes = (node.content || node).childNodes || [];
  const contents = nodes.filter(child => !(layout && child.nodeName === '#text' && /^[\t\n\f\r ]*$/.test(child.value)));
  const contentShape = node.tagName === 'script' && attr(node, 'type') === 'application/ld+json' ?
    jsonShape(jsonLD(node, 'existing output')) : contents.map(child => htmlShape(child, inContent));
  return [node.nodeName, node.namespaceURI, (node.attrs || []).map(({ name, value, namespace, prefix }) =>
    [prefix || '', name, namespace || '', value]).sort(), contentShape];
}

function sameHTML(before, after) {
  try {
    return JSON.stringify(htmlShape(documentHTML(before, 'existing output'))) ===
      JSON.stringify(htmlShape(documentHTML(after, 'rendered output')));
  } catch { return false; }
}

module.exports = { attr, children, documentHTML, elements, hasClass, hasRel, homeTemplate, jsonLD, sameHTML, text };
