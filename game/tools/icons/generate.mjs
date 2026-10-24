// Генерация иконок через OpenRouter (эндпоинт /api/v1/images).
//   OPENROUTER_API_KEY=... node tools/icons/generate.mjs [--model=meta/muse-image] [--only=goods/milk,...] [--budget=0.40] [--force]
// В облачном окружении Node нужно пустить через прокси: NODE_USE_ENV_PROXY=1.
// Ключ берётся только из переменной окружения и никогда не сохраняется в репозиторий.
// Исходники пишутся в assets/icons/raw/ (не коммитятся), стоимость — в assets/icons/costs.json.
// После генерации: python3 tools/icons/postprocess.py — прозрачный фон и 256×256 PNG.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const iconsRoot = join(here, '..', '..', 'assets', 'icons');
const rawRoot = join(iconsRoot, 'raw');
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error('Нужна переменная окружения OPENROUTER_API_KEY');
  process.exit(1);
}
const opt = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const model = opt('model', 'meta/muse-image');
const only = opt('only', null)?.split(',');
const budget = Number(opt('budget', '0.40'));
const force = process.argv.includes('--force');

const { style, icons } = JSON.parse(await readFile(join(here, 'icons.json'), 'utf8'));
const costsPath = join(iconsRoot, 'costs.json');
await mkdir(iconsRoot, { recursive: true });
const costs = JSON.parse(await readFile(costsPath, 'utf8').catch(() => '{}'));

async function hasRaw(name) {
  const dir = join(rawRoot, dirname(name));
  const base = name.split('/').pop();
  try {
    return (await readdir(dir)).some((f) => f.startsWith(`${base}.`));
  } catch {
    return false;
  }
}

async function generate(name, subject) {
  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: style.replace('{subject}', subject), aspect_ratio: '1:1' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json.error || json).slice(0, 300)}`);
  const img = json.data?.[0];
  if (!img?.b64_json) throw new Error(`в ответе нет картинки: ${JSON.stringify(json).slice(0, 300)}`);
  const ext = (img.media_type || 'image/png').split('/')[1].replace('jpeg', 'jpg');
  const file = join(rawRoot, `${name}.${ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(img.b64_json, 'base64'));
  return json.usage?.cost ?? 0;
}

let spent = 0;
for (const [name, subject] of Object.entries(icons)) {
  if (only && !only.includes(name)) continue;
  if (!force && (await hasRaw(name))) continue;
  if (spent >= budget) {
    console.log(`Бюджет $${budget} исчерпан, остановка.`);
    break;
  }
  try {
    const cost = await generate(name, subject);
    spent += cost;
    costs[name] = { model, cost };
    console.log(`✓ ${name}  $${cost}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
  }
  await writeFile(costsPath, JSON.stringify(costs, null, 2));
}
console.log(`Потрачено за запуск: $${spent.toFixed(3)} (${model})`);
