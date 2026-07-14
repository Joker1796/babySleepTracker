import dayjs from 'dayjs'
import { db } from '../db'

export async function exportBackup() {
  const data = {
    app: 'babySleepTracker',
    version: 2,
    exportedAt: new Date().toISOString(),
    children: await db.children.toArray(),
    events: await db.events.toArray(),
    illnesses: await db.illnesses.toArray()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `baby-tracker-${dayjs().format('YYYY-MM-DD')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file, { replace }) {
  const text = await file.text()
  const data = JSON.parse(text)
  if (data.app !== 'babySleepTracker' || !Array.isArray(data.children) || !Array.isArray(data.events)) {
    throw new Error('Файл не похож на резервную копию этого приложения')
  }
  // Болезни появились в v2 — в старых бэкапах их нет, это нормально.
  const illnesses = Array.isArray(data.illnesses) ? data.illnesses : []
  if (replace) {
    await db.events.clear()
    await db.children.clear()
    await db.illnesses.clear()
  }
  await db.children.bulkPut(data.children)
  await db.events.bulkPut(data.events)
  await db.illnesses.bulkPut(illnesses)
  return { children: data.children.length, events: data.events.length, illnesses: illnesses.length }
}
