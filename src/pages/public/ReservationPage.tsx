import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, AlertCircle, Clock, Calendar, ChevronRight, ChevronLeft, LogIn, UserPlus, User } from 'lucide-react'
import TimelineSlotPicker from '@/components/public/TimelineSlotPicker'
import { useAuth } from '@/contexts/AuthContext'
import { eventsApi, reservationsApi, surveysApi, timeSlotsApi, eventDatesApi } from '@/lib/api'
import { Button, Card, Input, Textarea, Checkbox, LoadingSpinner } from '@/components/ui'
import { reservationSchema, type ReservationFormValues } from '@/lib/validations'
import { cn, isWithinReservationPeriod, getRemainingCapacity, formatDate } from '@/lib/utils'
import type { Event, EventTimeSlot, EventDate, SurveyQuestion } from '@/types'

type StepId = 'auth' | 'info' | 'caution' | 'survey' | 'confirm'

interface Step {
  id: StepId
  label: string
}

export default function ReservationPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isCustomer, customer } = useAuth()

  // Data state
  const [event, setEvent] = useState<Event | null>(null)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [timeSlots, setTimeSlots] = useState<Array<EventTimeSlot & { reserved_count: number; remaining: number }>>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([])
  const [slotError, setSlotError] = useState<string>('')
  const [eventDates, setEventDates] = useState<Array<EventDate & { reserved_count: number; remaining: number }>>([])
  const [selectedDateId, setSelectedDateId] = useState<string>('')
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>([])
  const [dateError, setDateError] = useState<string>('')
  // 複数日+時間割の複数選択用: dateId -> slotId[]
  const [selectedDateSlotMap, setSelectedDateSlotMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Step state
  const [currentStep, setCurrentStep] = useState(0)

  // Form state
  const [agreedToCaution, setAgreedToCaution] = useState(false)
  const [cautionError, setCautionError] = useState<string | null>(null)
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string | string[]>>({})
  const [surveyErrors, setSurveyErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      participant_count: 1,
    },
  })

  const isMultiSelect = event?.allow_multi_slot_reservation ?? false

  // Dynamic steps based on event data
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = []
    if (!isCustomer) s.push({ id: 'auth', label: 'ログイン' })
    s.push({ id: 'info', label: 'お客様情報' })
    if (event?.caution_text) s.push({ id: 'caution', label: '注意事項' })
    if (questions.length > 0) s.push({ id: 'survey', label: 'アンケート' })
    s.push({ id: 'confirm', label: '確認・送信' })
    return s
  }, [event, questions, isCustomer])

  const currentStepId = steps[currentStep]?.id ?? 'info'
  const isLastStep = currentStep === steps.length - 1

  useEffect(() => {
    async function fetchData() {
      if (!eventId) return
      try {
        setLoading(true)
        const [eventData, count, surveyQuestions] = await Promise.all([
          eventsApi.getEvent(eventId),
          eventsApi.getConfirmedParticipantCount(eventId),
          surveysApi.getSurveyQuestions(eventId),
        ])
        setEvent(eventData)
        setConfirmedCount(count)
        setQuestions(surveyQuestions)

        if (eventData.use_multi_dates) {
          const [dates, dateCounts] = await Promise.all([
            eventDatesApi.getEventDates(eventData.id),
            eventDatesApi.getDateReservationCounts(eventData.id),
          ])
          const availableDates = dates.filter(d => d.is_available).map(d => ({
            ...d,
            reserved_count: dateCounts[d.id] || 0,
            remaining: d.capacity - (dateCounts[d.id] || 0),
          }))
          setEventDates(availableDates)

          // 日程+タイムスロット: 最初の日程のスロットを自動ロード
          if (eventData.use_time_slots && availableDates.length > 0) {
            const firstDateId = availableDates[0].id
            setSelectedDateId(firstDateId)
            const slots = await timeSlotsApi.getAvailableSlots(eventData.id, firstDateId)
            setTimeSlots(slots)
          }
        }

        if (eventData.use_time_slots && !eventData.use_multi_dates) {
          const slots = await timeSlotsApi.getAvailableSlots(eventData.id)
          setTimeSlots(slots)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [eventId])

  useEffect(() => {
    if (selectedDateId && event?.use_time_slots) {
      loadTimeSlotsForDate(selectedDateId)
    } else if (selectedDateId) {
      setTimeSlots([])
      setSelectedSlotId('')
    }
  }, [selectedDateId])

  async function loadTimeSlotsForDate(dateId: string) {
    try {
      const slots = await timeSlotsApi.getAvailableSlots(event!.id, dateId)
      setTimeSlots(slots)
      setSelectedSlotId('')
    } catch (err) {
      console.error('時間割の取得に失敗しました:', err)
    }
  }

  function parseOptions(optionsJson: unknown): string[] {
    if (Array.isArray(optionsJson)) return optionsJson as string[]
    return []
  }

  function handleSurveyChange(questionId: string, value: string | string[]) {
    setSurveyAnswers((prev) => ({ ...prev, [questionId]: value }))
    setSurveyErrors((prev) => { const next = { ...prev }; delete next[questionId]; return next })
  }

  function handleMultiChoiceToggle(questionId: string, option: string) {
    setSurveyAnswers((prev) => {
      const current = (prev[questionId] as string[]) ?? []
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      return { ...prev, [questionId]: updated }
    })
    setSurveyErrors((prev) => { const next = { ...prev }; delete next[questionId]; return next })
  }

  function isQuestionVisible(q: SurveyQuestion): boolean {
    if (!q.parent_question_id || !q.condition_value) return true
    const parentAnswer = surveyAnswers[q.parent_question_id]
    if (!parentAnswer) return false
    return Array.isArray(parentAnswer)
      ? parentAnswer.includes(q.condition_value)
      : parentAnswer === q.condition_value
  }

  function validateSurvey(): boolean {
    const newErrors: Record<string, string> = {}
    for (const q of questions) {
      if (!q.is_required || !isQuestionVisible(q)) continue
      const answer = surveyAnswers[q.id]
      if (q.question_type === 'free_text') {
        if (!answer || (typeof answer === 'string' && answer.trim() === '')) newErrors[q.id] = 'この質問は必須です'
      } else if (q.question_type === 'single_choice') {
        if (!answer || (typeof answer === 'string' && answer === '')) newErrors[q.id] = '選択してください'
      } else if (q.question_type === 'multiple_choice') {
        if (!answer || (Array.isArray(answer) && answer.length === 0)) newErrors[q.id] = '1つ以上選択してください'
      }
    }
    setSurveyErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // --- Step validation & navigation ---

  async function validateCurrentStep(): Promise<boolean> {
    if (currentStepId === 'info') {
      // Validate form fields
      const valid = await trigger()
      if (!valid) return false

      // Date validation
      if (event?.use_multi_dates) {
        if (isMultiSelect) {
          if (selectedDateIds.length === 0) { setDateError('参加する日程を1つ以上選択してください'); return false }
          if (event.use_time_slots) {
            const hasSlots = selectedDateIds.every(did => (selectedDateSlotMap[did]?.length ?? 0) > 0)
            if (!hasSlots) { setSlotError('各日程の時間帯を1つ以上選択してください'); return false }
          }
        } else {
          if (!selectedDateId) { setDateError('参加する日程を選択してください'); return false }
        }
      }
      // Time slot validation
      if (event?.use_time_slots && !event?.use_multi_dates) {
        if (isMultiSelect) {
          if (selectedSlotIds.length === 0) { setSlotError('時間帯を1つ以上選択してください'); return false }
        } else {
          if (!selectedSlotId) { setSlotError('時間帯を選択してください'); return false }
        }
      }
      return true
    }

    if (currentStepId === 'caution') {
      if (event?.caution_text && !agreedToCaution) {
        setCautionError('注意事項に同意してください')
        return false
      }
      setCautionError(null)
      return true
    }

    if (currentStepId === 'survey') {
      return validateSurvey()
    }

    return true
  }

  async function handleNext() {
    const valid = await validateCurrentStep()
    if (valid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
      window.scrollTo(0, 0)
    }
  }

  function handleBack() {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    window.scrollTo(0, 0)
  }

  async function handleSubmitReservation() {
    if (!event || !eventId) return

    const formData = getValues()

    try {
      setSubmitting(true)
      setSubmitError(null)

      const currentCount = await eventsApi.getConfirmedParticipantCount(eventId)
      const remaining = getRemainingCapacity(event.capacity, currentCount)

      if (remaining < formData.participant_count) {
        setSubmitError(
          remaining <= 0
            ? '申し訳ございません。定員に達したため予約できません。'
            : `残り${remaining}名分のみ予約可能です。参加人数を調整してください。`
        )
        return
      }

      if (!isWithinReservationPeriod(event.reservation_start_at, event.reservation_end_at)) {
        setSubmitError('予約受付期間外です。')
        return
      }

      if (event.use_time_slots && selectedSlotId) {
        const selectedSlot = timeSlots.find(s => s.id === selectedSlotId)
        if (selectedSlot && selectedSlot.remaining < formData.participant_count) {
          setSubmitError('選択した時間帯の残り枠数が不足しています')
          return
        }
      }

      const answers = questions
        .filter((q) => isQuestionVisible(q) && surveyAnswers[q.id] !== undefined && surveyAnswers[q.id] !== '')
        .map((q) => {
          const answer = surveyAnswers[q.id]
          if (q.question_type === 'multiple_choice') {
            return { question_id: q.id, answer_json: answer as string[] }
          }
          return { question_id: q.id, answer_text: answer as string }
        })

      // 予約データのベース
      const baseReservation = {
        event_id: eventId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        participant_count: formData.participant_count,
        note: formData.note,
        agreed_to_caution: event.caution_text ? agreedToCaution : true,
        caution_version: event.caution_version,
        answers: answers.length > 0 ? answers : undefined,
        customer_id: isCustomer && customer ? customer.id : undefined,
      }

      if (isMultiSelect) {
        // 複数選択: 選択ごとに予約を作成
        if (event.use_multi_dates && event.use_time_slots) {
          for (const dateId of selectedDateIds) {
            const slotIds = selectedDateSlotMap[dateId] ?? []
            for (const slotId of slotIds) {
              await reservationsApi.createReservation({ ...baseReservation, event_date_id: dateId, time_slot_id: slotId })
            }
          }
        } else if (event.use_multi_dates) {
          for (const dateId of selectedDateIds) {
            await reservationsApi.createReservation({ ...baseReservation, event_date_id: dateId })
          }
        } else if (event.use_time_slots) {
          for (const slotId of selectedSlotIds) {
            await reservationsApi.createReservation({ ...baseReservation, time_slot_id: slotId })
          }
        }
      } else {
        // 単一選択
        await reservationsApi.createReservation({
          ...baseReservation,
          event_date_id: event.use_multi_dates ? selectedDateId : undefined,
          time_slot_id: event.use_time_slots ? selectedSlotId : undefined,
        })
      }

      navigate(`/events/${eventId}/reserve/complete`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '予約に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Render helpers ---

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <p className="text-center text-red-600">{error ?? 'イベントが見つかりません'}</p>
          <div className="mt-4 text-center">
            <Link to="/" className="text-blue-600 hover:underline">イベント一覧に戻る</Link>
          </div>
        </Card>
      </div>
    )
  }

  const remaining = getRemainingCapacity(event.capacity, confirmedCount)
  const isFull = remaining <= 0
  const withinPeriod = isWithinReservationPeriod(event.reservation_start_at, event.reservation_end_at)
  const canReserve = !isFull && withinPeriod && event.is_accepting

  if (!canReserve) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-gray-900">予約できません</h2>
            <p className="text-gray-600">
              {isFull && '定員に達しているため予約できません。'}
              {!event.is_accepting && '現在予約を受け付けておりません。'}
              {!withinPeriod && !isFull && event.is_accepting && '予約受付期間外です。'}
            </p>
            <Link to={`/events/${event.id}`} className="mt-4 inline-block text-blue-600 hover:underline">
              イベント詳細に戻る
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back Link */}
      <Link
        to={`/events/${event.id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        イベント詳細に戻る
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">予約フォーム</h1>
      <p className="mb-4 text-gray-600">{event.title}</p>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
                    i < currentStep
                      ? 'bg-blue-600 text-white'
                      : i === currentStep
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {i + 1}
                </div>
                <span className={cn(
                  'mt-1 text-xs text-center',
                  i === currentStep ? 'font-semibold text-blue-700' : 'text-gray-500'
                )}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  'h-0.5 w-full mx-1 mt-[-1rem]',
                  i < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                )} />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-gray-500">
          ステップ {currentStep + 1} / {steps.length}
        </p>
      </div>

      {/* Step: Auth Choice (guest or login) */}
      {currentStepId === 'auth' && (
        <Card>
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">予約方法を選択してください</h2>
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-5 text-left transition hover:border-blue-400 hover:bg-blue-50"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                <User className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">ゲストとして予約する</div>
                <div className="mt-0.5 text-sm text-gray-500">アカウントなしで予約できます</div>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 text-gray-400" />
            </button>

            <a
              href={`/login?redirect=${encodeURIComponent(`/events/${eventId}/reserve`)}`}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-5 text-left transition hover:border-blue-400 hover:bg-blue-50"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <LogIn className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">ログインして予約する</div>
                <div className="mt-0.5 text-sm text-gray-500">お名前・メールが自動入力されます</div>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 text-gray-400" />
            </a>

            <a
              href={`/register?redirect=${encodeURIComponent(`/events/${eventId}/reserve`)}`}
              className="flex w-full items-center gap-4 rounded-xl border-2 border-gray-200 p-5 text-left transition hover:border-green-400 hover:bg-green-50"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">新規登録して予約する</div>
                <div className="mt-0.5 text-sm text-gray-500">次回から情報入力が不要になります</div>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 text-gray-400" />
            </a>
          </div>
        </Card>
      )}

      {/* Step: Date/Time + Personal Info */}
      {currentStepId === 'info' && (
        <>
          {/* Date + Time Slot: 日程をタブ、時間帯を直接表示 */}
          {event.use_multi_dates && event.use_time_slots && (
            <Card className="mb-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Clock className="h-5 w-5" />
                希望する時間帯を選択してください
              </h2>
              {isMultiSelect && (
                <p className="mb-3 text-xs text-blue-600">複数選択できます</p>
              )}
              {dateError && <p className="mb-3 text-sm text-red-600">{dateError}</p>}
              {slotError && <p className="mb-3 text-sm text-red-600">{slotError}</p>}

              {/* 日程タブ（複数日程の場合のみ表示） */}
              {eventDates.length > 1 && (
                <div className="mb-4 flex gap-2 overflow-x-auto">
                  {eventDates.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setDateError('')
                        setSlotError('')
                        if (isMultiSelect) {
                          setSelectedDateIds(prev =>
                            prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                          )
                        }
                        setSelectedDateId(d.id)
                        setSelectedSlotId('')
                      }}
                      className={cn(
                        'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                        selectedDateId === d.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {formatDate(d.event_date)}
                    </button>
                  ))}
                </div>
              )}

              {/* 選択中の日程ラベル */}
              {(() => {
                const current = eventDates.find(d => d.id === selectedDateId)
                if (!current) return null
                return (
                  <p className="mb-3 text-sm text-gray-600">
                    {formatDate(current.event_date)}
                    {' '}
                    {current.start_time.slice(0, 5)}{current.end_time ? ` 〜 ${current.end_time.slice(0, 5)}` : ''}
                  </p>
                )
              })()}

              {/* タイムライン */}
              {timeSlots.length > 0 ? (
                <TimelineSlotPicker
                  slots={timeSlots}
                  selectedSlotId={selectedSlotId}
                  onSelect={(id) => { setSlotError(''); setSelectedSlotId(id) }}
                  multi={isMultiSelect}
                  selectedSlotIds={isMultiSelect ? (selectedDateSlotMap[selectedDateId] ?? []) : selectedSlotIds}
                  onMultiSelect={(id) => {
                    setSlotError('')
                    if (isMultiSelect) {
                      setSelectedDateSlotMap(prev => {
                        const current = prev[selectedDateId] ?? []
                        return {
                          ...prev,
                          [selectedDateId]: current.includes(id)
                            ? current.filter(x => x !== id)
                            : [...current, id],
                        }
                      })
                    } else {
                      setSelectedSlotId(id)
                    }
                  }}
                />
              ) : (
                <p className="py-4 text-center text-sm text-gray-500">時間帯を読み込み中...</p>
              )}
            </Card>
          )}

          {/* Date Only (no time slots): 従来の日程選択UI */}
          {event.use_multi_dates && !event.use_time_slots && (
            <Card className="mb-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Calendar className="h-5 w-5" />
                参加する日程を選択してください
              </h2>
              {isMultiSelect && (
                <p className="mb-3 text-xs text-blue-600">複数選択できます</p>
              )}
              {dateError && <p className="mb-3 text-sm text-red-600">{dateError}</p>}
              <div className="space-y-3">
                {eventDates.map((d) => {
                  const isFull = d.remaining <= 0
                  const isSelected = isMultiSelect ? selectedDateIds.includes(d.id) : selectedDateId === d.id
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => {
                        setDateError('')
                        if (isMultiSelect) {
                          setSelectedDateIds(prev =>
                            prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                          )
                        } else {
                          setSelectedDateId(d.id)
                        }
                      }}
                      className={cn(
                        'w-full rounded-lg border-2 p-4 text-left transition',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : isFull
                            ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isMultiSelect && (
                            <input type="checkbox" checked={isSelected} readOnly
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 pointer-events-none" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">{formatDate(d.event_date)}</p>
                            <p className="text-sm text-gray-600">
                              {d.start_time.slice(0, 5)}{d.end_time ? ` 〜 ${d.end_time.slice(0, 5)}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className={cn('text-sm font-medium', isFull ? 'text-red-500' : 'text-green-600')}>
                          {isFull ? '満席' : `残り${d.remaining}枠`}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Time Slot (single date) */}
          {event.use_time_slots && !event.use_multi_dates && timeSlots.length > 0 && (
            <Card className="mb-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Clock className="h-5 w-5" />
                希望する時間帯を選択してください
              </h2>
              <p className="mb-3 text-sm font-medium text-gray-700">
                {formatDate(event.event_date)} {event.start_time.slice(0, 5)}〜{event.end_time.slice(0, 5)}
                {isMultiSelect && <span className="ml-2 text-xs text-blue-600">（複数選択可）</span>}
              </p>
              {slotError && <p className="mb-3 text-sm text-red-600">{slotError}</p>}
              <TimelineSlotPicker
                slots={timeSlots}
                selectedSlotId={selectedSlotId}
                onSelect={(id) => { setSlotError(''); setSelectedSlotId(id) }}
                multi={isMultiSelect}
                selectedSlotIds={selectedSlotIds}
                onMultiSelect={(id) => {
                  setSlotError('')
                  setSelectedSlotIds(prev =>
                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                  )
                }}
              />
            </Card>
          )}

          {/* Personal Information */}
          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">お客様情報</h2>
            <div className="space-y-4">
              <Input label="氏名" required placeholder="山田 太郎" error={errors.name?.message} {...register('name')} />
              <Input label="メールアドレス" type="email" required placeholder="example@email.com" error={errors.email?.message} {...register('email')} />
              <Input label="電話番号" type="tel" required placeholder="090-1234-5678" error={errors.phone?.message} {...register('phone')} />
              <Input label="参加人数" type="number" required min={1} max={10} error={errors.participant_count?.message} {...register('participant_count', { valueAsNumber: true })} />
              <Textarea label="備考" placeholder="ご質問やご要望がありましたらご記入ください" rows={3} error={errors.note?.message} {...register('note')} />
            </div>
          </Card>
        </>
      )}

      {/* Step: Caution */}
      {currentStepId === 'caution' && event.caution_text && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">注意事項</h2>
          <div className="mb-4 max-h-80 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-4">
            <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
              {event.caution_text}
            </p>
          </div>
          <Checkbox
            id="agree-caution"
            label="上記の注意事項に同意します"
            checked={agreedToCaution}
            onChange={(e) => {
              setAgreedToCaution(e.target.checked)
              if (e.target.checked) setCautionError(null)
            }}
            error={cautionError ?? undefined}
          />
        </Card>
      )}

      {/* Step: Survey */}
      {currentStepId === 'survey' && questions.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">アンケート</h2>
          <div className="space-y-6">
            {questions.map((question) => {
              const options = parseOptions(question.options_json)

              if (question.parent_question_id && question.condition_value) {
                const parentAnswer = surveyAnswers[question.parent_question_id]
                if (!parentAnswer) return null
                const matches = Array.isArray(parentAnswer)
                  ? parentAnswer.includes(question.condition_value)
                  : parentAnswer === question.condition_value
                if (!matches) return null
              }

              return (
                <div key={question.id}>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {question.question_text}
                    {question.is_required && <span className="ml-1 text-red-500">*</span>}
                  </label>

                  {question.question_type === 'single_choice' && (
                    <div className="space-y-2">
                      {options.map((option) => (
                        <label key={option} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name={`survey-${question.id}`}
                            value={option}
                            checked={surveyAnswers[question.id] === option}
                            onChange={() => handleSurveyChange(question.id, option)}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {question.question_type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {options.map((option) => {
                        const selected = (surveyAnswers[question.id] as string[]) ?? []
                        return (
                          <label key={option} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected.includes(option)}
                              onChange={() => handleMultiChoiceToggle(question.id, option)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {question.question_type === 'free_text' && (
                    <textarea
                      rows={3}
                      value={(surveyAnswers[question.id] as string) ?? ''}
                      onChange={(e) => handleSurveyChange(question.id, e.target.value)}
                      placeholder="ご回答を入力してください"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {surveyErrors[question.id] && (
                    <p className="mt-1 text-sm text-red-600">{surveyErrors[question.id]}</p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Step: Confirm */}
      {currentStepId === 'confirm' && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">予約内容の確認</h2>
          <dl className="divide-y divide-gray-100">
            {/* 日程・時間帯の確認表示 */}
            {event.use_multi_dates && (() => {
              const dateIds = isMultiSelect ? selectedDateIds : (selectedDateId ? [selectedDateId] : [])
              const selectedDates = eventDates.filter(ed => dateIds.includes(ed.id))
              if (selectedDates.length === 0) return null
              return (
                <div className="py-2">
                  <dt className="text-sm text-gray-500 mb-1">参加日程</dt>
                  <dd className="text-sm font-medium text-gray-900 space-y-1">
                    {selectedDates.map(d => {
                      const slotIds = isMultiSelect
                        ? (selectedDateSlotMap[d.id] ?? [])
                        : (selectedSlotId ? [selectedSlotId] : [])
                      const dateSlots = event.use_time_slots
                        ? timeSlots.filter(s => slotIds.includes(s.id))
                        : []
                      return (
                        <div key={d.id}>
                          <span>{formatDate(d.event_date)}</span>
                          {dateSlots.length > 0 && (
                            <span className="ml-2 text-gray-500">
                              {dateSlots.map(s => `${s.start_time.slice(0, 5)}〜${s.end_time.slice(0, 5)}`).join(', ')}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </dd>
                </div>
              )
            })()}
            {event.use_time_slots && !event.use_multi_dates && (() => {
              const slotIds = isMultiSelect ? selectedSlotIds : (selectedSlotId ? [selectedSlotId] : [])
              const selected = timeSlots.filter(s => slotIds.includes(s.id))
              if (selected.length === 0) return null
              const s = selected[0] // for single
              return isMultiSelect ? (
                <div className="py-2">
                  <dt className="text-sm text-gray-500 mb-1">時間帯</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {selected.map(s => `${s.start_time.slice(0, 5)}〜${s.end_time.slice(0, 5)}`).join(', ')}
                  </dd>
                </div>
              ) : s ? (
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-500">時間帯</dt>
                  <dd className="text-sm font-medium text-gray-900">{s.start_time.slice(0, 5)} 〜 {s.end_time.slice(0, 5)}</dd>
                </div>
              ) : null
            })()}
            <div className="py-2 flex justify-between">
              <dt className="text-sm text-gray-500">氏名</dt>
              <dd className="text-sm font-medium text-gray-900">{getValues('name')}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-sm text-gray-500">メールアドレス</dt>
              <dd className="text-sm font-medium text-gray-900">{getValues('email')}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-sm text-gray-500">電話番号</dt>
              <dd className="text-sm font-medium text-gray-900">{getValues('phone')}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-sm text-gray-500">参加人数</dt>
              <dd className="text-sm font-medium text-gray-900">{getValues('participant_count')}名</dd>
            </div>
            {getValues('note') && (
              <div className="py-2 flex justify-between">
                <dt className="text-sm text-gray-500">備考</dt>
                <dd className="text-sm font-medium text-gray-900">{getValues('note')}</dd>
              </div>
            )}
            {event.caution_text && (
              <div className="py-2 flex justify-between">
                <dt className="text-sm text-gray-500">注意事項</dt>
                <dd className="text-sm font-medium text-green-600">同意済み</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* Submit Error */}
      {submitError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {currentStep > 0 && (
          <Button type="button" variant="secondary" size="lg" onClick={handleBack} className="flex-1">
            <ChevronLeft className="mr-1 h-4 w-4" />
            戻る
          </Button>
        )}
        {!isLastStep ? (
          <Button type="button" size="lg" onClick={handleNext} className="flex-1">
            次へ
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="flex-1"
            loading={submitting}
            disabled={submitting}
            onClick={handleSubmitReservation}
          >
            予約を確定する
          </Button>
        )}
      </div>
    </div>
  )
}
