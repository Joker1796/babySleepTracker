// Единый источник норм для ребёнка: возрастные нормы по корректированному
// возрасту или параметры настраиваемого режима родителя.
import { getNorms, normsBeyondRange } from '../data/sleepNorms'
import { regimeToNorms } from '../data/regime'
import { correctedAgeInMonths } from './age'

// Младше этого возраста (мес) не оцениваем сон как «недосып»: режим ещё
// складывается, и короткие суммы сна — частый вариант нормы.
export const JUDGE_SLEEP_FROM_M = 3

export function customRegime(child) {
  return child?.regime?.mode === 'custom' ? child.regime : null
}

// Возраст для норм и советов (корректированный, если малыш недоношенный)
export function normsAgeM(child, now = Date.now()) {
  return child ? correctedAgeInMonths(child, now) : 6
}

// Нормы, по которым считаются прогнозы, подсказки и вердикты
export function effectiveNorms(child, now = Date.now()) {
  const ageNorms = getNorms(normsAgeM(child, now))
  const custom = customRegime(child)
  return custom ? regimeToNorms(custom, ageNorms) : ageNorms
}

// Возраст за пределами таблицы норм (старше года) — показать пометку
export function normsCappedForChild(child, now = Date.now()) {
  return !!child && normsBeyondRange(normsAgeM(child, now))
}
