import dayjs from 'dayjs'
import { db } from '../db'
import { BACKUP_APP, BACKUP_VERSION, parseBackupText, validateBackup } from './backupValidate'

export async function exportBackup() {
  const data = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
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
  // Некоторые браузеры начинают скачивание асинхронно — отзываем URL не сразу
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Читает и проверяет «шапку» файла (без записи в базу). Бросает понятную ошибку.
export async function readBackupFile(file) {
  return parseBackupText(await file.text())
}

// Импорт уже прочитанных данных: сначала валидация всех записей, затем
// одна транзакция — либо всё записалось, либо база осталась как была.
// replace: true — заменить всё; false — добавить (записи с теми же id перезапишутся).
export async function importBackup(data, { replace }) {
  const existingChildIds = replace ? [] : await db.children.toCollection().primaryKeys()
  const { children, events, illnesses, skipped, reasons } = validateBackup(data, { existingChildIds })
  if (replace && children.length === 0) {
    throw new Error('В файле нет ни одного корректного профиля — текущие данные не тронуты')
  }
  await db.transaction('rw', db.children, db.events, db.illnesses, async () => {
    if (replace) {
      await db.events.clear()
      await db.children.clear()
      await db.illnesses.clear()
    }
    await db.children.bulkPut(children)
    await db.events.bulkPut(events)
    await db.illnesses.bulkPut(illnesses)
  })
  return {
    imported: { children: children.length, events: events.length, illnesses: illnesses.length },
    skipped,
    reasons
  }
}
