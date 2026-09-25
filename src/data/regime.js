// Настраиваемый режим: родитель задаёт параметры сна вручную, они переопределяют
// возрастные нормы (SLEEP_NORMS). Хранится на записи ребёнка: child.regime.
import { getNorms, avgWakeWindow } from './sleepNorms'

export const DEFAULT_REGIME_MODE = 'auto'

// Допустимые значения числовых параметров (мин/шт). Всё, что вне диапазона
// или не число, в расчётах заменяется возрастной нормой.
export const REGIME_LIMITS = {
  wakeWindow: [15, 360],
  napCount: [1, 8],
  napDurationMin: [10, 240],
  nightSleepMin: [240, 900],
  windDownMin: [0, 90]
}
export const REGIME_TIME_KEYS = ['nightStart', 'morningWake']

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function isValidHHMM(s) {
  return typeof s === 'string' && HHMM_RE.test(s)
}

// 'HH:MM' → минуты от полуночи, или null
export function parseHHMM(s) {
  const m = typeof s === 'string' ? HHMM_RE.exec(s) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function fmtHHMM(min) {
  const v = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

// Середина диапазона 'HH:MM'..'HH:MM'
export function midTime(from, to) {
  return fmtHHMM((parseHHMM(from) + parseHHMM(to)) / 2)
}

function avg(range) {
  return Math.round((range[0] + range[1]) / 2)
}

// Число из поля формы/хранилища: null, если пусто, не число или вне диапазона.
// round — для целых значений (минуты, число снов).
export function sanitizeRegimeNumber(key, raw) {
  const limits = REGIME_LIMITS[key]
  if (!limits || raw === '' || raw == null || typeof raw === 'boolean') return null
  const v = Number(raw)
  if (!Number.isFinite(v)) return null
  const r = Math.round(v)
  return r >= limits[0] && r <= limits[1] ? r : null
}

// То же, но для записи из формы: значение вне диапазона прижимаем к границе
// (родитель ввёл 0 снов → 1), пустое/нечисловое → null (не сохраняем).
export function clampRegimeNumber(key, raw) {
  const limits = REGIME_LIMITS[key]
  if (!limits || raw === '' || raw == null) return null
  const v = Number(raw)
  if (!Number.isFinite(v)) return null
  return Math.min(limits[1], Math.max(limits[0], Math.round(v)))
}

// Начальные значения настраиваемого режима из текущих возрастных норм —
// чтобы при первом включении цифры были осмысленными.
export function seedRegimeFromNorms(ageM) {
  const norms = getNorms(ageM)
  const napCount = Math.max(1, avg(norms.naps))
  const daySleep = avg(norms.daySleep)
  return {
    mode: 'custom',
    wakeWindow: avgWakeWindow(norms),
    napCount,
    napDurationMin: Math.round(daySleep / napCount),
    nightStart: midTime(norms.bedtime[0], norms.bedtime[1]),
    morningWake: '07:00',
    nightSleepMin: avg(norms.nightSleep),
    windDownMin: 30,
    shortNapReduce: true
  }
}

// Собирает объект в форме элемента SLEEP_NORMS из пользовательских значений,
// чтобы движок (advisor) и правила работали без изменений.
// base — возрастные нормы: из них берутся значения на место пустых/битых полей.
export function regimeToNorms(regime = {}, base = getNorms(6)) {
  const r = regime || {}
  const pick = (key, fallback) => sanitizeRegimeNumber(key, r[key]) ?? fallback
  const w = pick('wakeWindow', avgWakeWindow(base))
  const n = pick('napCount', Math.max(1, avg(base.naps)))
  const dur = pick('napDurationMin', Math.round(avg(base.daySleep) / n))
  const ns = pick('nightSleepMin', avg(base.nightSleep))
  const daySleep = n * dur
  const bedtime = isValidHHMM(r.nightStart)
    ? fmtHHMM(parseHHMM(r.nightStart))
    : midTime(base.bedtime[0], base.bedtime[1])
  return {
    fromM: 0, toM: 999, label: 'Свой режим',
    custom: true,
    wakeWindow: [w, w],
    naps: [n, n],
    daySleep: [daySleep, daySleep],
    nightSleep: [ns, ns],
    totalSleep: [daySleep + ns, daySleep + ns],
    typicalTotal: [daySleep + ns, daySleep + ns],
    bedtime: [bedtime, bedtime],
    morningWake: isValidHHMM(r.morningWake) ? fmtHHMM(parseHHMM(r.morningWake)) : null,
    note: ''
  }
}
