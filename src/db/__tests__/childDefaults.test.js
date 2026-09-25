import { describe, it, expect } from 'vitest'
import { fillChildDefaults, CHILD_COLORS } from '../childDefaults'

describe('fillChildDefaults', () => {
  it('дозаполняет отсутствующие поля старой записи', () => {
    const c = fillChildDefaults({ id: 'a', name: 'Вася', birthDate: '2025-01-01' }, 1)
    expect(c).toEqual({
      id: 'a', name: 'Вася', birthDate: '2025-01-01',
      color: CHILD_COLORS[1], feeding: 'breast', aids: [], gender: null, regime: { mode: 'auto' }
    })
  })

  it('не меняет уже заданные значения', () => {
    const src = {
      id: 'a', color: '#123', feeding: 'mixed', aids: ['swaddle'], gender: 'male',
      regime: { mode: 'custom', wakeWindow: 80 }
    }
    const c = fillChildDefaults(src)
    expect(c).toEqual(src)
    expect(c).not.toBe(src)
  })
})
