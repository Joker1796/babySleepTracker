import { defineStore } from 'pinia'
import { db, uid } from '../db'

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
    async add({ name, birthDate, color, feeding, aids }) {
      const child = {
        id: uid(),
        name,
        birthDate,
        color: color || CHILD_COLORS[this.children.length % CHILD_COLORS.length],
        feeding: feeding || 'breast',
        aids: aids || []
      }
      await db.children.put(child)
      this.children.push(child)
      this.setActive(child.id)
      return child
    },
    async update(child) {
      await db.children.put({ ...child })
      const i = this.children.findIndex(c => c.id === child.id)
      if (i !== -1) this.children[i] = { ...child }
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
