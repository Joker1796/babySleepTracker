import { defineStore } from 'pinia'
import { db, uid } from '../db'
import { ageInMonths } from '../logic/age'
import { seedRegimeFromNorms } from '../data/regime'
import { DEFAULT_MAIN_BUTTONS } from '../data/eventTypes'

export const CHILD_COLORS = ['#7c6ff0', '#2f9e6e', '#d9598b', '#2492c9', '#d97706', '#8a5cd6']

export const useChildrenStore = defineStore('children', {
  state: () => ({
    children: [],
    activeChildId: localStorage.getItem('activeChildId') || null,
    loaded: false
  }),
  getters: {
    activeChild(state) {
      return state.children.find(c => c.id === state.activeChildId) || state.children[0] || null
    }
  },
  actions: {
    async load() {
      this.children = await db.children.toArray()
      this.loaded = true
    },
    async add({ name, birthDate, color, feeding, aids, gender, mainButtons, hideHints }) {
      const child = {
        id: uid(),
        name,
        birthDate,
        color: color || CHILD_COLORS[this.children.length % CHILD_COLORS.length],
        feeding: feeding || 'breast',
        aids: aids || [],
        gender: gender || null,
        mainButtons: mainButtons || DEFAULT_MAIN_BUTTONS,
        hideHints: hideHints || false,
        regime: { mode: 'auto' }
      }
      await db.children.put(child)
      this.children.push(child)
      this.setActive(child.id)
      return child
    },
    async update(child) {
      // Снимаем реактивность Vue: вложенные массивы/объекты (например, aids, regime)
      // могут остаться Proxy, а IndexedDB их не клонирует (DataCloneError).
      const plain = JSON.parse(JSON.stringify(child))
      await db.children.put(plain)
      const i = this.children.findIndex(c => c.id === plain.id)
      if (i !== -1) this.children[i] = plain
    },
    // Переключение режима «Авто ⇄ Настраиваемый». При первом включении custom —
    // засеваем параметры из возрастных норм, чтобы значения были осмысленными.
    async setRegimeMode(id, mode) {
      const child = this.children.find(c => c.id === id)
      if (!child) return
      let regime
      if (mode === 'custom') {
        regime = child.regime && child.regime.wakeWindow != null
          ? { ...child.regime, mode: 'custom' }
          : seedRegimeFromNorms(ageInMonths(child.birthDate))
      } else {
        regime = { ...(child.regime || {}), mode: 'auto' }
      }
      await this.update({ ...child, regime })
    },
    async updateRegime(id, patch) {
      const child = this.children.find(c => c.id === id)
      if (!child) return
      await this.update({ ...child, regime: { ...(child.regime || { mode: 'custom' }), ...patch } })
    },
    async remove(id) {
      await db.events.where('childId').equals(id).delete()
      await db.children.delete(id)
      this.children = this.children.filter(c => c.id !== id)
      if (this.activeChildId === id) this.setActive(this.children[0]?.id || null)
    },
    setActive(id) {
      this.activeChildId = id
      if (id) localStorage.setItem('activeChildId', id)
      else localStorage.removeItem('activeChildId')
    }
  }
})
