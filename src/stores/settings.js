import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: localStorage.getItem('theme') || 'auto',
    // Ночной режим экрана: 'auto' — сам включается ночью (см. logic/nightMode.js), 'off' — никогда
    nightMode: localStorage.getItem('nightMode') || 'auto',
    nightActive: false
  }),
  actions: {
    init() {
      this.applyTheme()
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme())
    },
    setTheme(theme) {
      this.theme = theme
      localStorage.setItem('theme', theme)
      this.applyTheme()
    },
    setNightMode(mode) {
      this.nightMode = mode
      localStorage.setItem('nightMode', mode)
    },
    // Вызывается из App.vue, когда меняется время или состояние сна
    applyNight(on) {
      this.nightActive = on
      if (on) document.documentElement.dataset.night = '1'
      else delete document.documentElement.dataset.night
      this.applyTheme()
    },
    applyTheme() {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = this.theme === 'dark' || (this.theme === 'auto' && prefersDark)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      // Цвет системной строки браузера — под фон шапки текущей темы
      const color = this.nightActive ? '#0f0e14' : dark ? '#12131c' : '#f6f1e7'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    }
  }
})
