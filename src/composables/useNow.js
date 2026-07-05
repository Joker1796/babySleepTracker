import { ref } from 'vue'

// Единый реактивный «текущий момент», тикает раз в 30 секунд —
// от него пересчитываются таймеры, прогнозы и подсказки.
//
// Для тестирования (dev) поддерживается смещение времени: можно сдвинуть «сейчас»
// вперёд/назад, и часы продолжат идти от новой точки. Смещение хранится в
// localStorage и переживает перезагрузку.
const OFFSET_KEY = 'devTimeOffsetMs'

function loadOffset() {
  try { return Number(localStorage.getItem(OFFSET_KEY)) || 0 } catch { return 0 }
}

// Смещение в ref — чтобы компоненты (dev-панель) реактивно отражали симуляцию.
const offset = ref(loadOffset())

// Симулированный «сейчас»: реальное время плюс смещение.
export function simNow() {
  return Date.now() + offset.value
}

const now = ref(simNow())

setInterval(() => { now.value = simNow() }, 30000)

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) now.value = simNow()
})

export function useNow() {
  return now
}

// События пишутся с точным временем, а тик — раз в 30 с: без немедленного
// обновления свежая запись «из будущего» не попадает в расчёты до следующего тика.
export function touchNow() {
  now.value = simNow()
}

export function setSimulatedNow(ts) {
  offset.value = ts == null ? 0 : ts - Date.now()
  try { localStorage.setItem(OFFSET_KEY, String(offset.value)) } catch { /* игнор */ }
  touchNow()
}

export function resetSimulatedNow() {
  setSimulatedNow(null)
}

export function isTimeSimulated() {
  return offset.value !== 0
}
