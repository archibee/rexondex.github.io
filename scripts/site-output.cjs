const { randomUUID } = require('node:crypto');
const { fs, path, read } = require('./site-common.cjs');
const { sameHTML } = require('./site-html.cjs');

function outputPath(root, name) {
  const parts = name.split('/');
  let current = root;
  for (const [index, part] of parts.entries()) {
    if (!part || part === '..' || part === '.') throw Error(`Invalid output path: ${name}`);
    const entries = fs.existsSync(current) ? fs.readdirSync(current) : null;
    if (entries && !entries.includes(part) && entries.some(entry => entry.toLowerCase() === part.toLowerCase())) {
      throw Error(`${name}: fix the capitalization of '${part}' to match the generated path.`);
    }
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat && !(index === parts.length - 1 ? stat.isFile() : stat.isDirectory())) {
      throw Error(`${name}: move the conflicting path ${path.relative(root, current)}. Expected a regular output path.`);
    }
  }
  return current;
}

function isCurrent(target, content) {
  if (!fs.existsSync(target)) return false;
  // Queued thumbnail buffers also need their modification time refreshed.
  if (Buffer.isBuffer(content)) return false;
  const existing = read(target).replace(/\r\n/g, '\n');
  const rendered = content.replace(/\r\n/g, '\n');
  return existing === rendered || (target.endsWith('.html') && sameHTML(existing, rendered));
}

function changes(root, pending) {
  return [...pending].map(([name, content]) => ({ name, content, target: outputPath(root, name) }))
    .filter(({ target, content }) => !isCurrent(target, content));
}

function commit(outputs) {
  const id = randomUUID(), transactions = [], directories = [];
  function ensureDirectory(directory) {
    if (fs.existsSync(directory)) return;
    ensureDirectory(path.dirname(directory));
    fs.mkdirSync(directory);
    directories.push(directory);
  }
  try {
    for (const { target, content } of outputs) {
      const temp = `${target}.seo-tmp-${id}`, backup = `${target}.seo-backup-${id}`;
      ensureDirectory(path.dirname(target));
      const item = { target, temp, backup, had: fs.existsSync(target), applied: false };
      transactions.push(item);
      fs.writeFileSync(temp, content, { flag: 'wx' });
      if (item.had) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    }
    for (const item of transactions) {
      fs.renameSync(item.temp, item.target);
      item.applied = true;
    }
  } catch (error) {
    const failed = new Set();
    for (const item of transactions.reverse()) {
      if (!item.applied) continue;
      try {
        if (item.had) fs.copyFileSync(item.backup, item.target);
        else fs.unlinkSync(item.target);
      } catch { failed.add(item); }
    }
    cleanup(transactions, failed);
    for (const directory of directories.reverse()) {
      try { fs.rmdirSync(directory); } catch { /* A non-empty directory is retained. */ }
    }
    const details = failed.size ? `Restore these paths manually: ${[...failed].map(item => item.had ? item.backup : item.target).join(', ')}` : 'Existing outputs restored.';
    throw Error(`Could not save generated files: ${error.message}. ${details}`);
  }
  cleanup(transactions, new Set());
}

function cleanup(transactions, retain) {
  for (const item of transactions) {
    try {
      fs.rmSync(item.temp, { force: true });
      if (!retain.has(item)) fs.rmSync(item.backup, { force: true });
    } catch (error) { console.warn(`[WARN] ${error.message}`); }
  }
}

async function withBuildLock(root, check, run) {
  const lock = path.join(root, '.static-site-build.lock');
  const busy = () => Error(`${lock}: a build is already running. If it was interrupted, confirm it has exited and remove the lock before retrying.`);
  if (check) {
    if (fs.lstatSync(lock, { throwIfNoEntry: false })) throw busy();
    return run();
  }
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) { throw error.code === 'EEXIST' ? busy() : error; }
  try {
    fs.writeFileSync(fd, `${process.pid}\n`);
    return await run();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}

module.exports = { changes, commit, outputPath, withBuildLock };
