import fs from 'node:fs';
import path from 'node:path';

const files = [
  'random.ts','types.ts','config.ts','roleRatings.ts','generator.ts','body.ts','nameData.ts','identity.ts',
  'geography.ts','calendar.ts','development.ts','poolLifecycle.ts','playerFactory.ts','batch.ts'
];

let failed = false;

for (const file of files) {
  const sourcePath = path.join('packages','simulation-core','src',file);
  const mirrorPath = path.join('supabase','functions','generate-players','simulation',file);
  const source = fs.readFileSync(sourcePath,'utf8')
    .replace(/from '(\.\/[^']+)\.js'/g, "from '$1.ts'");
  const mirror = fs.readFileSync(mirrorPath,'utf8');

  if (source !== mirror) {
    console.error(`Edge simulation mirror drifted: ${file}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Edge simulation mirror matches the shared simulation core.');
