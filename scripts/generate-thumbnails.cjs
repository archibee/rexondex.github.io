const { fs, path, dirs, imagePattern } = require('./site-common.cjs');
const sharp = require('sharp');
const { changes, commit, outputPath, withBuildLock } = require('./site-output.cjs');

async function planThumbnails(root, check) {
  const outputs = new Map();
  const stale = new Map();
  for (const sector of dirs(path.join(root, 'media')).filter(entry => entry.isDirectory())) {
    const directory = `media/${sector.name}`;
    const photos = dirs(path.join(root, directory)).filter(entry => entry.isFile() && imagePattern.test(entry.name));
    for (const { name } of photos) {
      const photo = `${directory}/${name}`;
      const thumbnail = `thumbnails/${sector.name}/${name}.webp`;
      const source = path.join(root, photo);
      const target = outputPath(root, thumbnail);
      const stat = fs.lstatSync(target, { throwIfNoEntry: false });
      let reason = stat ? 'photo is newer' : 'missing';
      if (stat && stat.mtimeMs >= fs.statSync(source).mtimeMs) {
        try {
          const image = sharp(target);
          const { format, width, height } = await image.metadata();
          if (format === 'webp' && width <= 480 && height <= 480) {
            await image.raw().toBuffer();
            continue;
          }
          reason = 'expected WebP up to 480px';
        } catch { reason = 'invalid WebP'; }
      }
      stale.set(thumbnail, reason);
      if (check) {
        outputs.set(thumbnail, Buffer.alloc(0));
        continue;
      }
      try {
        const buffer = await sharp(source, { animated: false }).rotate()
          .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
        outputs.set(thumbnail, buffer);
      } catch (error) {
        throw Error(`${photo}: could not create ${thumbnail}. Check that the original opens correctly. ${error.message}`);
      }
    }
  }
  return { outputs, stale };
}

if (require.main === module) {
  const args = process.argv.slice(2), rootOption = args.indexOf('--site-root');
  const root = path.resolve(rootOption < 0 ? path.join(__dirname, '..') : args[rootOption + 1]);
  const check = args.includes('--check');
  withBuildLock(root, check, async () => {
    if (!fs.existsSync(path.join(root, 'media'))) return;
    const { outputs, stale } = await planThumbnails(root, check);
    if (check && stale.size) throw Error(`${stale.size} thumbnail(s) are missing or out of date. Run the build without --check.\n${[...stale].map(([name, reason]) => `  - ${name} (${reason})`).join('\n')}`);
    if (!check) {
      const updated = changes(root, outputs);
      commit(updated);
      for (const { name } of updated) console.log(`Created ${name}`);
    }
  }).catch(error => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { planThumbnails };
