import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
let output;
for (const candidate of ['out', 'dist/client']) {
  try {
    await access(join(candidate, 'index.html'));
    output = candidate;
    break;
  } catch {}
}
if (!output)
  throw new Error(
    'Static index.html not found. Run vinext build with output: export first.',
  );
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();
}
const files = (await walk(output)).filter(
  (p) =>
    !p.endsWith('.map') &&
    !p.endsWith('sw.js') &&
    !relative(output, p).startsWith('.'),
);
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(await readFile(f));
const version = hash.digest('hex').slice(0, 16);
const paths = [
  './',
  ...files.map((f) => './' + relative(output, f).replaceAll('\\', '/')),
];
const worker = `/* Generated from the full static build. User data is stored separately in IndexedDB. */
const CACHE = 'malzeit-shell-${version}';
const ASSETS = ${JSON.stringify(paths)};
const ROOT = new URL('./', self.location.href).href;
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try { for(const path of ASSETS){const url=new URL(path,ROOT).href;const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));if(!response.ok||response.redirected)throw new Error('Offline asset unavailable: '+path);await cache.put(url,response)} }
 catch(error){await caches.delete(CACHE);throw error}
})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('malzeit-shell-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
 for(const client of await self.clients.matchAll())client.postMessage({type:'MALZEIT_OFFLINE_READY'});
})())});
self.addEventListener('fetch',event=>{
 const request=event.request;const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(request);if(cached)return cached;
 if(request.mode==='navigate'){const shell=await cache.match(ROOT);if(shell)return shell}
 return fetch(request);
})());
});
`;
await writeFile(join(output, 'sw.js'), worker);
await writeFile(join(output, '.nojekyll'), '');
const manifest = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
if (manifest.static?.directory !== output)
  throw new Error('Set static.directory in .openai/hosting.json to ' + output);
console.log(
  'Offline shell: ' +
    files.length +
    ' files, version ' +
    version +
    ', output ' +
    output,
);
