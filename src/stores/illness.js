import { defineStore } from 'pinia'
import { db } from '../db'
import { simNow, touchNow } from '../composables/useNow'
import { newIllness, newMedication } from '../data/illness'

// Хранилище болезней активного ребёнка. Одна активная болезнь (endedAt == null),
// прошлые сохраняются в БД. По образцу stores/events.js.
export const useIllnessStore = defineStore('illness', {
  state: () => ({
    illnesses: [],
    loadedFor: null
  }),
  getters: {
    active(state) {
      return state.illnesses.find(i => i.endedAt == null) || null
    },
    hasActive() {
      return this.active != null
    }
  },
  actions: {
    async load(childId) {
      this.illnesses = await db.illnesses.where('childId').equals(childId).sortBy('startedAt')
      this.loadedFor = childId
    },
    // Начать болезнь: создаёт запись с настройками по умолчанию и делает её активной.
    async start() {
      const rec = newIllness(this.loadedFor, simNow())
      await db.illnesses.put(rec)
      this.illnesses.push(rec)
      touchNow()
      return rec
    },
    // Сохранить изменённую болезнь целиком. Снимаем реактивность Vue перед put:
    // вложенные массивы (medications) иначе остаются Proxy → DataCloneError.
    async save(illness) {
      const plain = JSON.parse(JSON.stringify(illness))
      await db.illnesses.put(plain)
      const i = this.illnesses.findIndex(x => x.id === plain.id)
      if (i !== -1) this.illnesses[i] = plain
      else this.illnesses.push(plain)
      touchNow()
      return plain
    },
    // Точечный патч активной болезни.
    async update(patch) {
      const cur = this.active
      if (!cur) return
      await this.save({ ...cur, ...patch })
    },
    // Выздоровление: закрываем активную болезнь текущим моментом, запись остаётся.
    async recover() {
      const cur = this.active
      if (!cur) return
      await this.save({ ...cur, endedAt: simNow() })
    },
    async addMedication() {
      const cur = this.active
      if (!cur) return
      await this.save({ ...cur, medications: [...(cur.medications || []), { ...newMedication(), startedAt: simNow() }] })
    },
    async updateMedication(medId, patch) {
      const cur = this.active
      if (!cur) return
      const medications = (cur.medications || []).map(m => (m.id === medId ? { ...m, ...patch } : m))
      await this.save({ ...cur, medications })
    },
    async removeMedication(medId) {
      const cur = this.active
      if (!cur) return
      await this.save({ ...cur, medications: (cur.medications || []).filter(m => m.id !== medId) })
    }
  }
})
