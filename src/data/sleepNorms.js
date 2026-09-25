// Нормы сна по возрастам (0–12 мес). Время — в минутах, если не указано иное.
//
// Источники суммарного сна за сутки (с учётом ночных пробуждений):
// — NSF (National Sleep Foundation, 2015): 0–3 мес — 14–17 ч;
// — AASM (American Academy of Sleep Medicine, 2016; поддержано AAP): 4–12 мес —
//   12–16 ч (для младше 4 мес консенсуса AASM нет — разброс слишком велик).
// totalSleep — этот широкий рекомендованный коридор: по нему оцениваем
// «ниже/выше нормы», достижения дня и вердикты статистики.
// typicalTotal — более узкий «типичный центр», где оказывается большинство детей
// (справочно, для подсказок; оценку по нему не делаем).
// daySleep + nightSleep согласованы с totalSleep: сумма нижних границ = нижняя
// граница суток, сумма верхних = верхняя.
// nightSleep — сон в ночной период с учётом пробуждений на кормление.
//
// Окна бодрствования (wakeWindow), число снов и отбой — эмпирические ориентиры
// консультантов по сну, а не клинические нормы: главный сигнал — признаки
// усталости конкретного малыша.
export const SLEEP_NORMS = [
  {
    fromM: 0, toM: 1, label: '0–1 мес',
    wakeWindow: [40, 60], naps: [4, 8],
    daySleep: [360, 480], nightSleep: [480, 540], totalSleep: [840, 1020], typicalTotal: [900, 1020],
    bedtime: ['20:00', '22:00'],
    note: 'Режим ещё хаотичен: новорождённый спит короткими отрезками днём и ночью. Ориентируйтесь на признаки усталости, а не на часы.'
  },
  {
    fromM: 1, toM: 2, label: '1–2 мес',
    wakeWindow: [60, 75], naps: [4, 6],
    daySleep: [360, 420], nightSleep: [480, 600], totalSleep: [840, 1020], typicalTotal: [900, 1020],
    bedtime: ['20:00', '22:00'],
    note: 'Начинает выделяться более длинный ночной сон. Помогайте различать день и ночь: днём свет и звуки, ночью темнота и тишина.'
  },
  {
    fromM: 2, toM: 3, label: '2–3 мес',
    wakeWindow: [75, 90], naps: [4, 5],
    daySleep: [300, 420], nightSleep: [540, 600], totalSleep: [840, 1020], typicalTotal: [900, 1020],
    bedtime: ['19:30', '21:30'],
    note: 'Появляются намётки режима. Хорошее время начать простой ритуал укладывания.'
  },
  {
    fromM: 3, toM: 4, label: '3–4 мес',
    wakeWindow: [90, 120], naps: [3, 4],
    daySleep: [240, 360], nightSleep: [540, 660], totalSleep: [780, 1020], typicalTotal: [840, 960],
    bedtime: ['19:00', '21:00'],
    note: 'Приближается регресс сна 4 месяцев — сон перестраивается на «взрослые» циклы. Возможный переход с 4 на 3 дневных сна.'
  },
  {
    fromM: 4, toM: 6, label: '4–6 мес',
    wakeWindow: [105, 150], naps: [3, 4],
    daySleep: [180, 300], nightSleep: [540, 660], totalSleep: [720, 960], typicalTotal: [840, 900],
    bedtime: ['19:00', '21:00'],
    note: 'Обычно 3–4 дневных сна; ближе к полугоду чаще три: два основных и короткий вечерний. Режим становится предсказуемее.'
  },
  {
    fromM: 6, toM: 8, label: '6–8 мес',
    wakeWindow: [135, 180], naps: [2, 3],
    daySleep: [150, 240], nightSleep: [570, 720], totalSleep: [720, 960], typicalTotal: [780, 840],
    bedtime: ['19:00', '21:00'],
    note: 'Период перехода с 3 на 2 дневных сна: третий (вечерний) сон постепенно уходит.'
  },
  {
    fromM: 8, toM: 10, label: '8–10 мес',
    wakeWindow: [180, 210], naps: [2, 2],
    daySleep: [120, 180], nightSleep: [600, 720], totalSleep: [720, 900], typicalTotal: [780, 840],
    bedtime: ['19:00', '21:00'],
    note: 'Два дневных сна: утренний и обеденный. Возможен регресс из-за скачка развития (ползание, вставание).'
  },
  {
    fromM: 10, toM: 13, label: '10–12 мес',
    wakeWindow: [210, 240], naps: [1, 2],
    daySleep: [120, 180], nightSleep: [600, 720], totalSleep: [720, 900], typicalTotal: [750, 840],
    bedtime: ['19:00', '21:00'],
    note: 'У большинства всё ещё 2 дневных сна. Переход на один сон обычно случается позже — в 12–18 месяцев.'
  }
]

// Нормы рассчитаны на первый год: старше — отдаём последнюю группу (10–12 мес).
export const NORMS_MAX_AGE_M = 12

export function getNorms(ageMonths) {
  const m = Math.max(0, Number(ageMonths) || 0)
  return SLEEP_NORMS.find(n => m >= n.fromM && m < n.toM) || SLEEP_NORMS[SLEEP_NORMS.length - 1]
}

// Возраст вышел за пределы таблицы норм — в интерфейсе нужна пометка
export function normsBeyondRange(ageMonths) {
  return ageMonths >= NORMS_MAX_AGE_M
}

export function avgWakeWindow(norms) {
  return Math.round((norms.wakeWindow[0] + norms.wakeWindow[1]) / 2)
}
