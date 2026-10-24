// Генерация иконок через OpenRouter.
//   OPENROUTER_API_KEY=... node tools/icons/generate.mjs [модель] [--only=goods/milk,...] [--force]
// Ключ берётся только из переменной окружения и никогда не сохраняется в репозиторий.
// Картинки пишутся в assets/icons/<группа>/<имя>.png, стоимость каждой — в assets/icons/costs.json.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outRoot = join(here, '..', '..', 'assets', 'icons');
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error('Нужна переменная окружения OPENROUTER_API_KEY');
  process.exit(1);
}
const args = process.argv.slice(2);
const model = args.find((a) => !a.startsWith('--')) || 'openai/gpt-image-2';
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const force = args.includes('--force');

const { style, icons } = JSON.parse(await readFile(join(here, 'icons.json'), 'utf8'));
const costsPath = join(outRoot, 'costs.json');
const costs = JSON.parse(await readFile(costsPath, 'utf8').catch(() => '{}'));

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function generate(name, subject) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      modalities: ['image', 'text'],
      messages: [{ role: 'user', content: style.replace('{subject}', subject) }],
      image_config: { aspect_ratio: '1:1' },
      usage: { include: true },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json.error || json)}`);
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith('data:image/')) throw new Error(`в ответе нет картинки: ${JSON.stringify(json).slice(0, 300)}`);
  const file = join(outRoot, `${name}.png`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
  return json.usage?.cost ?? null;
}

let total = 0;
for (const [name, subject] of Object.entries(icons)) {
  if (only && !only.includes(name)) continue;
  if (!force && (await exists(join(outRoot, `${name}.png`)))) continue;
  try {
    const cost = await generate(name, subject);
    costs[name] = { model, cost };
    total += cost || 0;
    console.log(`✓ ${name}  $${cost ?? '?'}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
  }
  await writeFile(costsPath, JSON.stringify(costs, null, 2));
}
console.log(`Итого за запуск: $${total.toFixed(4)} (${model})`);
