import { cn } from '@/lib/utils'
import type { EventTimeSlot } from '@/types'

type SlotWithAvailability = EventTimeSlot & { reserved_count: number; remaining: number }

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function fillPercent(slot: SlotWithAvailability): number {
  if (slot.capacity <= 0) return 100
  return Math.min(100, Math.round((slot.reserved_count / slot.capacity) * 100))
}

interface TimelineSlotPickerProps {
  slots: SlotWithAvailability[]
  selectedSlotId: string
  onSelect: (slotId: string) => void
  /** 複数選択モード */
  multi?: boolean
  selectedSlotIds?: string[]
  onMultiSelect?: (slotId: string) => void
}

export default function TimelineSlotPicker({
  slots,
  selectedSlotId,
  onSelect,
  multi,
  selectedSlotIds = [],
  onMultiSelect,
}: TimelineSlotPickerProps) {
  if (slots.length === 0) return null

  // 全体の時間範囲
  const allStart = Math.min(...slots.map(s => toMinutes(s.start_time)))
  const allEnd = Math.max(...slots.map(s => toMinutes(s.end_time)))
  const totalRange = allEnd - allStart

  // 30分刻みの時間軸ラベル
  const axisStart = Math.floor(allStart / 30) * 30
  const axisEnd = Math.ceil(allEnd / 30) * 30
  const axisLabels: number[] = []
  for (let t = axisStart; t <= axisEnd; t += 30) {
    axisLabels.push(t)
  }

  return (
    <div className="space-y-1">
      {/* 時間軸ヘッダー */}
      <div className="flex items-end pl-2 pr-2">
        <div className="relative h-5 flex-1">
          {axisLabels.map((t) => {
            const left = totalRange > 0 ? ((t - allStart) / totalRange) * 100 : 0
            if (left < 0 || left > 100) return null
            return (
              <span
                key={t}
                className="absolute -translate-x-1/2 text-[10px] text-gray-400"
                style={{ left: `${left}%` }}
              >
                {t % 60 === 0 ? fromMinutes(t) : ''}
              </span>
            )
          })}
        </div>
      </div>

      {/* スロット一覧 */}
      {slots.map((slot) => {
        const isFull = slot.remaining <= 0
        const isSelected = multi
          ? selectedSlotIds.includes(slot.id)
          : selectedSlotId === slot.id
        const pct = fillPercent(slot)

        // バーの位置計算
        const left = totalRange > 0 ? ((toMinutes(slot.start_time) - allStart) / totalRange) * 100 : 0
        const width = totalRange > 0 ? ((toMinutes(slot.end_time) - toMinutes(slot.start_time)) / totalRange) * 100 : 100

        return (
          <button
            key={slot.id}
            type="button"
            disabled={isFull}
            onClick={() => {
              if (multi && onMultiSelect) {
                onMultiSelect(slot.id)
              } else {
                onSelect(slot.id)
              }
            }}
            className={cn(
              'group relative flex h-14 w-full items-center rounded-lg border-2 px-2 transition',
              isSelected
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : isFull
                  ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
            )}
          >
            {/* 背景の埋まりバー */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div
                className="absolute left-0 top-0 h-full rounded-lg"
                style={{ width: `${width}%`, marginLeft: `${left}%` }}
              >
                <div
                  className={cn(
                    'h-full rounded-lg transition-all',
                    isFull
                      ? 'bg-red-100'
                      : pct >= 80
                        ? 'bg-yellow-100'
                        : pct > 0
                          ? 'bg-green-50'
                          : 'bg-emerald-50'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* コンテンツ */}
            <div className="relative z-10 flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                {multi && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 pointer-events-none"
                  />
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {slot.start_time.slice(0, 5)} 〜 {slot.end_time.slice(0, 5)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* ミニバー */}
                <div className="hidden h-2 w-16 overflow-hidden rounded-full bg-gray-200 sm:block">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isFull ? 'bg-red-400' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isFull ? 'text-red-500' : pct >= 80 ? 'text-yellow-600' : 'text-green-600'
                )}>
                  {isFull ? '満席' : `残り${slot.remaining}枠`}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
