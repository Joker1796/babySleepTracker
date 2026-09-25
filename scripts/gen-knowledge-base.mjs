// Генерирует KNOWLEDGE_BASE.md из данных приложения:
// статьи — src/data/tips.js, таблица норм — src/data/sleepNorms.js.
// Запуск: npm run kb. Руками KNOWLEDGE_BASE.md не правим — правим tips.js и перегенерируем.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIPS, TIP_CATEGORIES, TIP_SOURCES, TIPS_DISCLAIMER } from '../src/data/tips.js'
import { SLEEP_NORMS } from '../src/data/sleepNorms.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function dur(min) {
  if (min == null || Number.isNaN(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} мин`
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`
}

const range = (r, fmt = v => v, sep = ' – ') =>
  Array.isArray(r) ? (r[0] === r[1] ? fmt(r[0]) : `${fmt(r[0])}${sep}${fmt(r[1])}`) : '—'

function ageLabel(t) {
  if (t.ageFromM <= 0 && t.ageToM >= 12) return 'весь первый год'
  return `${t.ageFromM}–${t.ageToM} мес`
}

// plain-текст статьи → markdown: «— » → «- », пустая строка перед списком
function bodyToMd(body) {
  const out = []
  for (const line of body.split('\n')) {
    const isItem = line.startsWith('— ')
    const prev = out[out.length - 1]
    if (isItem && prev !== undefined && prev !== '' && !prev.startsWith('- ')) out.push('')
    if (!isItem && line !== '' && prev !== undefined && prev.startsWith('- ')) out.push('')
    out.push(isItem ? `- ${line.slice(2)}` : line)
  }
  return out.join('\n')
}

const cats = TIP_CATEGORIES
  .map(c => ({ ...c, tips: TIPS.filter(t => t.category === c.id) }))
  .filter(c => c.tips.length)

const md = []
md.push('# База знаний «Режим малыша»', '')
md.push(`Справочник по сну и режиму ребёнка 0–12 месяцев. ${TIPS_DISCLAIMER}`, '')
md.push('> Файл генерируется автоматически командой `npm run kb` из `src/data/tips.js` и `src/data/sleepNorms.js`. Правки вносите в эти файлы, а не сюда.', '')
md.push('---', '')

md.push('## Нормы сна по возрастам', '')
md.push('Окна бодрствования и распорядок — практические ориентиры, а не строгие медицинские нормы. Для недоношенных малышей ориентируйтесь на корректированный возраст.', '')
md.push('| Возраст | Окно бодрствования | Дневных снов | Дневной сон | Ночной сон | Всего за сутки | Укладывание на ночь |')
md.push('|---|---|---|---|---|---|---|')
for (const n of SLEEP_NORMS) {
  md.push(`| ${n.label} | ${range(n.wakeWindow, dur)} | ${range(n.naps)} | ${range(n.daySleep, dur)} | ${range(n.nightSleep, dur)} | ${range(n.totalSleep, dur)} | ${range(n.bedtime, v => v, '–')} |`)
}
md.push('')
for (const n of SLEEP_NORMS) if (n.note) md.push(`**${n.label}.** ${n.note}`, '')
md.push('---', '')

md.push('## Статьи', '')
for (const c of cats) {
  md.push(`- ${c.icon} **${c.label}**`)
  for (const t of c.tips) md.push(`  - ${t.title}`)
}
md.push('', '')

for (const c of cats) {
  md.push(`## ${c.icon} ${c.label}`, '')
  for (const t of c.tips) {
    md.push(`### ${t.title}`, '', `_Возраст: ${ageLabel(t)}_`, '', bodyToMd(t.body), '')
  }
  md.push('')
}

md.push('---', '', '## Источники', '')
for (const s of TIP_SOURCES) md.push(`- **${s.title}.** ${s.ref}`)
md.push('', '---', '')
md.push(`Всего статей: ${TIPS.length}. Источник — данные приложения (\`src/data/tips.js\`, \`src/data/sleepNorms.js\`).`, '')

writeFileSync(join(root, 'KNOWLEDGE_BASE.md'), md.join('\n'))
console.log(`KNOWLEDGE_BASE.md: ${TIPS.length} статей, ${SLEEP_NORMS.length} строк норм`)
