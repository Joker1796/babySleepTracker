import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { buildAdvice } from '../advisor'
import { ADVISOR_RULES, napsNormLabel } from '../../data/advisorRules'

const ts = s => dayjs(s).valueOf()

// 5 месяцев на 4 июля 2026 → нормы 4–6 мес: окно 105–150 мин (среднее 128)
const child = { id: 'c1', name: 'Тест', birthDate: '2026-02-01' }

function sleep(start, end) {
  return { id: start, type: 'sleep', startedAt: ts(start), endedAt: end ? ts(end) : null }
}

describe('buildAdvice: прогноз следующего сна', () => {
  it('обычный сон → следующее укладывание через среднее окно', () => {
    const a = buildAdvice({
      child,
      events: [sleep('2026-07-04T12:30', '2026-07-04T14:00')],
      now: ts('2026-07-04T15:00')
    })
    expect(a.ageM).toBe(5)
    expect(a.nextNapAt).toBe(ts('2026-07-04T14:00') + 128 * 60000)
    expect(Math.round(a.wakeWindowLeft)).toBe(68)
  })

  it('короткий сон → окно сокращается, укладывание раньше', () => {
    const short = buildAdvice({
      child,
      events: [sleep('2026-07-04T13:30', '2026-07-04T14:00')], // 30 мин
      now: ts('2026-07-04T14:30')
    })
    // окно после короткого сна: max(105*0.75, 105-20) = 85 мин
    expect(short.wakeWindowMin).toBe(85)
    expect(short.nextNapAt).toBe(ts('2026-07-04T14:00') + 85 * 60000)
    expect(short.advices.map(x => x.id)).toContain('short-nap')
  })

  it('во время сна прогноз следующего сна не строится', () => {
    const a = buildAdvice({
      child,
      events: [sleep('2026-07-04T14:00', null)],
      now: ts('2026-07-04T14:30')
    })
    expect(a.nextNapAt).toBeNull()
    expect(a.state.sleeping).not.toBeNull()
  })
})

describe('buildAdvice: правила', () => {
  it('окно превышено → жёлтая подсказка-ориентир, не «срочно»', () => {
    const a = buildAdvice({
      child,
      events: [sleep('2026-07-04T09:00', '2026-07-04T10:00')],
      now: ts('2026-07-04T12:20') // бодрствует 140 мин при окне 128
    })
    expect(a.wakeWindowLeft).toBeLessThan(0)
    const rule = a.advices.find(x => x.id === 'window-exceeded')
    expect(rule).toBeTruthy()
    expect(rule.priority).toBe(2)
    expect(rule.text).toContain('ориентир')
    expect(rule.text).toContain('признаки усталости')
  })

  it('окно на исходе → подсказка про ритуал', () => {
    const a = buildAdvice({
      child,
      events: [sleep('2026-07-04T09:00', '2026-07-04T10:00')],
      now: ts('2026-07-04T12:05') // осталось 10 мин из 135
    })
    expect(a.advices.map(x => x.id)).toContain('window-soon')
  })

  it('нет данных о сне → просьба отметить', () => {
    const a = buildAdvice({ child, events: [], now: ts('2026-07-04T12:00') })
    expect(a.nextNapAt).toBeNull()
    expect(a.advices.map(x => x.id)).toContain('log-morning')
  })

  it('дефицит дневного сна вечером → раннее укладывание', () => {
    const a = buildAdvice({
      child,
      events: [sleep('2026-07-04T13:00', '2026-07-04T14:00')], // 60 мин при норме от 180
      now: ts('2026-07-04T17:00')
    })
    const ids = a.advices.map(x => x.id)
    expect(ids).toContain('day-sleep-deficit')
    // укладывание сдвинуто раньше стандартного 19:30
    expect(a.bedtimeAt).toBeLessThan(ts('2026-07-04T19:30'))
  })

  it('возрастная подсказка о регрессе 4 месяцев', () => {
    const fourMonths = { ...child, birthDate: '2026-03-01' } // ровно 4 мес
    const a = buildAdvice({ child: fourMonths, events: [], now: ts('2026-07-04T12:00') })
    expect(a.advices.map(x => x.id)).toContain('regression-4m')
  })

  it('пеленание после 2 месяцев → предупреждение, помечено как совет из профиля', () => {
    const swaddled = { ...child, aids: ['swaddle'] }
    const a = buildAdvice({ child: swaddled, events: [], now: ts('2026-07-04T12:00') })
    const rule = a.advices.find(x => x.id === 'swaddle-stop')
    expect(rule).toBeTruthy()
    expect(rule.profile).toBe(true)
    // без пеленания правило не срабатывает
    const plain = buildAdvice({ child, events: [], now: ts('2026-07-04T12:00') })
    expect(plain.advices.map(x => x.id)).not.toContain('swaddle-stop')
  })

  it('засыпание на груди после 4 мес вечером → совет про ассоциацию, текст зависит от кормления', () => {
    const events = [sleep('2026-07-04T15:00', '2026-07-04T16:00')]
    const now = ts('2026-07-04T17:30')
    const bf = buildAdvice({ child: { ...child, feeding: 'breast', aids: ['feeding-to-sleep'] }, events, now })
    const bfAdvice = bf.advices.find(x => x.id === 'feeding-to-sleep-assoc')
    expect(bfAdvice).toBeTruthy()
    expect(bfAdvice.text).toContain('на груди')
    const ff = buildAdvice({ child: { ...child, feeding: 'formula', aids: ['feeding-to-sleep'] }, events, now })
    expect(ff.advices.find(x => x.id === 'feeding-to-sleep-assoc').text).toContain('с бутылочкой')
  })

  it('текст про перегул учитывает белый шум из профиля', () => {
    const events = [sleep('2026-07-04T08:00', '2026-07-04T09:00')]
    const now = ts('2026-07-04T12:00') // 180 мин бодрствования при окне 128 → дольше ориентира на 30+ мин
    const noAids = buildAdvice({ child, events, now })
    expect(noAids.advices.find(x => x.id === 'window-exceeded-hard').text).toContain('шшш')
    const withNoise = buildAdvice({ child: { ...child, aids: ['white-noise'] }, events, now })
    expect(withNoise.advices.find(x => x.id === 'window-exceeded-hard').text).toContain('белый шум')
  })

  it('правила отсортированы по приоритету', () => {
    const a = buildAdvice({
      child,
      events: [sleep('2026-07-04T09:00', '2026-07-04T10:00')],
      now: ts('2026-07-04T12:40')
    })
    const priorities = a.advices.map(x => x.priority)
    expect(priorities).toEqual([...priorities].sort((x, y) => y - x))
  })
})

describe('buildAdvice: приоритеты и тексты', () => {
  it('красный приоритет — только у правил безопасности', () => {
    const SAFETY = ['swaddle-stop']
    const urgent = ADVISOR_RULES.filter(r => r.priority === 3).map(r => r.id)
    expect(urgent.every(id => SAFETY.includes(id))).toBe(true)
    for (const id of ['window-soon', 'window-exceeded', 'window-exceeded-hard', 'bedtime-passed']) {
      expect(ADVISOR_RULES.find(r => r.id === id).priority).toBeLessThan(3)
    }
  })

  it('в текстах нет категоричных формулировок про перегул', () => {
    const c = {
      wakeWindowLeft: -60, usesAid: () => false, t: () => '20:00', dur: m => `${m} мин`,
      nextNapAt: 0, bedtimeAt: 0, lastNapMin: 20, feeding: 'breast', ageM: 6,
      today: { napCount: 1, daySleepMin: 60 }, norms: { daySleep: [180, 240], naps: [3, 3] }
    }
    const texts = ADVISOR_RULES.map(r => { try { return r.text(c) } catch { return '' } }).join(' ')
    expect(texts).not.toMatch(/строго|точк[аи] невозврата|в разы|докладыва/i)
  })

  it('норма «3–3» пишется как «3 дневных сна»', () => {
    expect(napsNormLabel([3, 3])).toBe('3 дневных сна')
    expect(napsNormLabel([2, 3])).toBe('2–3 дневных сна')
    expect(napsNormLabel([1, 1])).toBe('1 дневной сон')
  })

  it('меньше снов, чем в норме 8–10 мес → «при норме 2 дневных сна»', () => {
    const c = { ...child, birthDate: '2025-10-15' } // 8 мес
    const a = buildAdvice({ child: c, events: [sleep('2026-07-04T11:00', '2026-07-04T13:00')], now: ts('2026-07-04T17:30') })
    const rule = a.advices.find(x => x.id === 'nap-count-low')
    expect(rule.text).toContain('при норме 2 дневных сна')
  })

  it('один сон в 10 мес → «до года обычно рано, чаще в 12–18 мес»', () => {
    const c = { ...child, birthDate: '2025-09-01' } // 10 мес
    const a = buildAdvice({ child: c, events: [sleep('2026-07-04T11:00', '2026-07-04T13:00')], now: ts('2026-07-04T16:30') })
    const rule = a.advices.find(x => x.id === 'transition-2-1')
    expect(rule.text).toMatch(/До года .* рано/)
    expect(rule.text).toContain('12–18')
  })
})

describe('buildAdvice: корректированный возраст', () => {
  it('недоношенный: нормы и советы — по возрасту от ПДР', () => {
    // фактически 6 мес, родился на 2 месяца раньше срока → корр. 4 мес
    const preterm = { ...child, birthDate: '2026-01-01', dueDate: '2026-03-01' }
    const a = buildAdvice({ child: preterm, events: [], now: ts('2026-07-04T12:00') })
    expect(a.actualAgeM).toBe(6)
    expect(a.ageM).toBe(4)
    expect(a.norms.label).toBe('4–6 мес')
    expect(a.advices.map(x => x.id)).toContain('regression-4m')
  })

  it('ПДР на неделю позже рождения — возраст фактический', () => {
    const c = { ...child, birthDate: '2026-01-01', dueDate: '2026-01-08' }
    const a = buildAdvice({ child: c, events: [], now: ts('2026-07-04T12:00') })
    expect(a.ageM).toBe(6)
  })
})

describe('buildAdvice: устойчивость и нормы', () => {
  it('битый свой режим не ломает правила и прогнозы', () => {
    const c = { ...child, regime: { mode: 'custom', wakeWindow: 'abc', napCount: 0, napDurationMin: NaN, nightStart: '99:99', windDownMin: 'x' } }
    const a = buildAdvice({ child: c, events: [sleep('2026-07-04T12:30', '2026-07-04T14:00')], now: ts('2026-07-04T15:00') })
    expect(Number.isFinite(a.nextNapAt)).toBe(true)
    expect(Number.isFinite(a.bedtimeAt)).toBe(true)
    expect(a.windDownMin).toBe(30)
    expect(a.norms.naps[0]).toBeGreaterThanOrEqual(1)
  })

  it('младше 3 мес — нет «дефицита дневного сна» и раннего отбоя', () => {
    const newborn = { ...child, birthDate: '2026-06-01' } // 1 мес
    const a = buildAdvice({ child: newborn, events: [sleep('2026-07-04T13:00', '2026-07-04T13:40')], now: ts('2026-07-04T17:00') })
    expect(a.advices.map(x => x.id)).not.toContain('day-sleep-deficit')
    expect(a.advices.map(x => x.id)).not.toContain('nap-count-low')
  })

  it('привычный отбой из истории сдвигает прогноз (в пределах диапазона ±30 мин)', () => {
    const events = [
      sleep('2026-07-01T21:00', '2026-07-02T07:00'),
      sleep('2026-07-02T21:00', '2026-07-03T07:00'),
      sleep('2026-07-03T21:00', '2026-07-04T07:00')
    ]
    const a = buildAdvice({ child, events, now: ts('2026-07-04T10:00') })
    expect(a.bedtimeAt).toBe(ts('2026-07-04T21:00'))
    // без истории — середина диапазона 19:00–21:00
    const b = buildAdvice({ child, events: [], now: ts('2026-07-04T10:00') })
    expect(b.bedtimeAt).toBe(ts('2026-07-04T20:00'))
  })

  it('custom-режим: нормы из effectiveNorms, привычный отбой не мешает', () => {
    const c = { ...child, regime: { mode: 'custom', wakeWindow: 100, napCount: 3, napDurationMin: 60, nightSleepMin: 660, nightStart: '19:30' } }
    const a = buildAdvice({ child: c, events: [], now: ts('2026-07-04T10:00') })
    expect(a.norms.custom).toBe(true)
    expect(a.bedtimeAt).toBe(ts('2026-07-04T19:30'))
  })
})
