const vm = require('node:vm');
const postcss = require('postcss');
const { fs, path, dirs, read, imagePattern, imageLike } = require('./site-common.cjs');

const scripts = ['legacy-links.js', 'theme-init.js', 'app.js'];
const styles = ['theme.css', 'style.css'];
const required = ['.nojekyll', 'index.html', 'robots.txt', ...scripts, ...styles];
const siteFolders = ['database', 'media', 'pictures', 'thumbnails'];
const known = new Set([...required, ...siteFolders, '.git', '.github', '.githooks', '.gitignore', 'node_modules',
  'scripts', 'docs', 'README.md', 'package.json', 'package-lock.json', 'picture-order.json', 'pictures.js', 'database.js',
  'pictures.html', 'archive.html', 'sitemap.xml', 'favicon.ico', 'favicon.svg', 'favicon-96x96.png', 'apple-touch-icon.png',
  'rexondex.jpg', '.static-site-build.lock']);
const housekeeping = name => /^(?:\.DS_Store|Thumbs\.db|desktop\.ini|\.gitkeep)$/i.test(name);

function preflight(root) {
  const errors = [];
  const error = (name, hint) => errors.push(`${name}: ${hint}`);
  const warn = (name, hint) => console.warn(`[WARN] ${name}: ${hint}`);
  const rootEntries = new Map(dirs(root).map(entry => [entry.name, entry]));
  for (const name of required) {
    if (!rootEntries.get(name)?.isFile()) error(name, 'Restore this required site file with the exact name.');
  }
  for (const name of siteFolders) {
    if (rootEntries.has(name) ? !rootEntries.get(name).isDirectory() : ['database', 'media'].includes(name)) {
      error(`${name}/`, 'Use a real directory with the exact name.');
    }
  }
  for (const name of ['picture', 'picutre']) {
    if (rootEntries.has(name)) error(name, `Obsolete '${name}/'. Move photo sources to media/<sector>/ and review old pages.`);
  }
  for (const entry of rootEntries.values()) {
    if (!known.has(entry.name) && !housekeeping(entry.name) && !['picture', 'picutre'].includes(entry.name)) {
      warn(entry.name, 'Outside the current site layout. Review its placement and whether it belongs in the Pages repository.');
    }
  }

  function inspect(directory, visit) {
    const seen = new Map();
    for (const entry of dirs(path.join(root, directory))) {
      const name = `${directory}/${entry.name}`;
      const caseKey = entry.name.toLowerCase();
      if (seen.has(caseKey)) error(name, `Name differs only in case from ${seen.get(caseKey)}. Use distinct names on Windows and Pages.`);
      seen.set(caseKey, name);
      if (entry.isSymbolicLink()) error(name, 'Replace this link with a regular file or directory inside the site.');
      else if (!housekeeping(entry.name)) visit(entry, name);
    }
  }
  if (rootEntries.get('database')?.isDirectory()) inspect('database', (entry, name) => {
    if (!entry.isFile() && /^\d{6}\.html$/i.test(entry.name)) error(name, 'Diary entry is a folder. Use an HTML file.');
    else if (/^\d{6}\.html$/.test(entry.name) || (entry.isFile() && /^draft-/.test(entry.name))) return;
    else if (/^\d.*\.html?$/i.test(entry.name)) error(name, 'Use YYMMDD.html for a published diary or prefix a draft with draft-.');
    else warn(name, 'Outside the diary input pattern. Publish diaries as database/YYMMDD.html.');
  });
  if (rootEntries.get('media')?.isDirectory()) inspect('media', (entry, name) => {
    if (!entry.isDirectory()) {
      if (imageLike.test(entry.name)) error(name, 'Photos must be inside a sector folder.');
      else warn(name, 'Place photo files directly in media/<sector>/.');
      return;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(entry.name)) error(name, 'Invalid photo sector. Use ASCII letters, digits or hyphens.');
    inspect(name, (photo, photoPath) => {
      if (photo.isDirectory()) error(photoPath, 'Nested photo folders are not supported. Move photos to the sector directory.');
      else if (!photo.isFile()) error(photoPath, 'Use a regular photo file.');
      else if (!imagePattern.test(photo.name)) {
        if (imageLike.test(photo.name)) error(photoPath, 'Unsupported photo format. Use JPG, PNG, WebP, GIF, AVIF or HEIC.');
        else warn(photoPath, 'File is outside the gallery input formats.');
      }
    });
  });
  for (const directory of ['pictures', 'thumbnails']) {
    if (!rootEntries.get(directory)?.isDirectory()) continue;
    inspect(directory, (entry, name) => {
      if (directory === 'pictures') {
        if (!entry.isFile() || !/\.html$/i.test(entry.name)) warn(name, 'Outside the gallery output pattern. Review this path.');
      } else if (entry.isDirectory()) {
        inspect(name, (thumbnail, target) => {
          const source = `media/${entry.name}/${thumbnail.name.slice(0, -5)}`;
          if (!thumbnail.isFile() || !thumbnail.name.endsWith('.webp') || !fs.existsSync(path.join(root, source))) {
            warn(target, 'Thumbnail without a matching photo. Review whether to remove this file.');
          }
        });
      } else warn(name, 'Place generated thumbnails under thumbnails/<sector>/.');
    });
  }
  const styleRules = [];
  const themeRules = new Set();
  for (const name of [...scripts, ...styles]) {
    if (!rootEntries.get(name)?.isFile()) continue;
    try {
      const source = read(path.join(root, name));
      if (!source.trim()) throw Error('File is empty. Restore the original source.');
      if (scripts.includes(name)) new vm.Script(source, { filename: name });
      else {
        const stylesheet = postcss.parse(source, { from: name });
        if (!stylesheet.nodes.some(node => node.type !== 'comment')) throw Error('Stylesheet has no rules.');
        stylesheet.walkRules(rule => {
          if (rule.nodes.some(node => node.type === 'decl')) styleRules.push(...rule.selectors);
          const theme = /:root\[\s*data-theme\s*=\s*(['"]?)(light|dark)\1\s*\]/.exec(rule.selector)?.[2];
          if (theme && rule.nodes.some(node => node.type === 'decl' && node.prop === 'color-scheme' && node.value === theme)) themeRules.add(theme);
        });
      }
    } catch (failure) {
      const line = failure.line || failure.stack?.match(/^[^\n]*:(\d+)\r?\n/)?.[1];
      error(line ? `${name}:${line}` : name, `${failure.reason || failure.message} Fix the source syntax.`);
    }
  }
  if (styleRules.length) {
    for (const className of ['social-shell', 'main-column', 'view-header', 'diary-post', 'post-content', 'picture-grid']) {
      if (!styleRules.some(selector => new RegExp(`\\.${className}(?![\\w-])`).test(selector))) error('style.css / theme.css', `Missing layout rule for .${className}. Review the stylesheet changes.`);
    }
    for (const theme of ['light', 'dark']) if (!themeRules.has(theme)) error('theme.css / style.css', `Missing ${theme} color-scheme rule for :root[data-theme].`);
  }
  if (errors.length) throw Error(`Site layout or input errors:\n${errors.map(message => `  - ${message}`).join('\n')}`);
}

module.exports = { preflight, scripts, styles };
