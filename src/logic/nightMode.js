import dayjs from 'dayjs'

// Ночной режим экрана: очень тёмная тёплая тема, которая не слепит при
// кормлении в 3 часа ночи. Включается сам:
// — с 22:00 до 6:00;
// — или раньше, если малыш уже уснул ночным сном (заснул с 19:00).
export const NIGHT_FROM_H = 22
export const NIGHT_TO_H = 6
const NIGHT_SLEEP_FROM_H = 19

export function isNightTime(now = Date.now(), currentSleep = null) {
  const h = dayjs(now).hour()
  if (h >= NIGHT_FROM_H || h < NIGHT_TO_H) return true
  if (currentSleep && currentSleep.endedAt == null) {
    const sh = dayjs(currentSleep.startedAt).hour()
    return sh >= NIGHT_SLEEP_FROM_H && h >= NIGHT_SLEEP_FROM_H
  }
  return false
}
