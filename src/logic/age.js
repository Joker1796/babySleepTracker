import dayjs from 'dayjs'

// birthDate — строка 'YYYY-MM-DD'
export function ageInMonths(birthDate, now = Date.now()) {
  return dayjs(now).diff(dayjs(birthDate), 'month')
}

export function ageInWeeks(birthDate, now = Date.now()) {
  return dayjs(now).diff(dayjs(birthDate), 'week')
}

export function ageInDays(birthDate, now = Date.now()) {
  return dayjs(now).diff(dayjs(birthDate), 'day')
}

// ── Корректированный возраст для недоношенных ──
// Если малыш родился раньше ПДР (child.dueDate) хотя бы на 2 недели, то до
// 2 лет фактического возраста развитие и сон принято оценивать по возрасту
// «от ПДР». Нормы, подсказки и регрессы считаем по нему.
export const PRETERM_MIN_DAYS = 14
export const CORRECTED_AGE_UNTIL_M = 24

// На сколько дней раньше срока родился малыш (0 — в срок или dueDate не задана)
export function daysBorneEarly(child) {
  if (!child?.birthDate || !child?.dueDate) return 0
  const d = dayjs(child.dueDate).diff(dayjs(child.birthDate), 'day')
  return Number.isFinite(d) && d > 0 ? d : 0
}

// Нужно ли сейчас учитывать корректированный возраст
export function usesCorrectedAge(child, now = Date.now()) {
  if (daysBorneEarly(child) < PRETERM_MIN_DAYS) return false
  return ageInMonths(child.birthDate, now) < CORRECTED_AGE_UNTIL_M
}

// Возраст (в полных месяцах), по которому считаются нормы и советы
export function correctedAgeInMonths(child, now = Date.now()) {
  if (!child?.birthDate) return 0
  if (!usesCorrectedAge(child, now)) return ageInMonths(child.birthDate, now)
  return Math.max(0, ageInMonths(child.dueDate, now))
}

// «корр. 3 мес» — для показа рядом с фактическим возрастом (или null)
export function correctedAgeLabel(child, now = Date.now()) {
  if (!usesCorrectedAge(child, now)) return null
  return `корр. ${correctedAgeInMonths(child, now)} мес`
}

export function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function formatAge(birthDate, now = Date.now()) {
  const days = ageInDays(birthDate, now)
  if (days < 0) return 'ещё не родился'
  if (days < 14) return `${days} ${plural(days, 'день', 'дня', 'дней')}`
  const months = ageInMonths(birthDate, now)
  if (months < 1) {
    const weeks = ageInWeeks(birthDate, now)
    return `${weeks} ${plural(weeks, 'неделя', 'недели', 'недель')}`
  }
  if (months >= 12) {
    const years = Math.floor(months / 12)
    const rest = months % 12
    const base = `${years} ${plural(years, 'год', 'года', 'лет')}`
    return rest > 0 ? `${base} ${rest} мес` : base
  }
  const weeksLeft = dayjs(now).diff(dayjs(birthDate).add(months, 'month'), 'week')
  const base = `${months} мес`
  return weeksLeft > 0 ? `${base} ${weeksLeft} нед` : base
}

// Фактический возраст + корректированный, если он учитывается:
// «3 мес 1 нед · корр. 1 мес»
export function formatChildAge(child, now = Date.now()) {
  if (!child?.birthDate) return ''
  const base = formatAge(child.birthDate, now)
  const corr = correctedAgeLabel(child, now)
  return corr ? `${base} · ${corr}` : base
}

export function formatDurationMin(min) {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${rest} мин`
  if (rest === 0) return `${h} ч`
  return `${h} ч ${rest} мин`
}
