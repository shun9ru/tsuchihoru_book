import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { eventsApi, waitlistsApi } from '@/lib/api'
import { Button, Card, Input, Textarea, LoadingSpinner } from '@/components/ui'
import { getRemainingCapacity } from '@/lib/utils'
import type { Event } from '@/types'

const waitlistSchema = z.object({
  name: z
    .string()
    .min(1, '氏名は必須です'),
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('有効なメールアドレスを入力してください'),
  phone: z
    .string()
    .min(1, '電話番号は必須です')
    .regex(/^(0\d{1,4}-?\d{1,4}-?\d{3,4})$/, '有効な電話番号を入力してください（例: 090-1234-5678）'),
  participant_count: z
    .number({ message: '参加人数を入力してください' })
    .min(1, '参加人数は1名以上で入力してください')
    .max(10, '参加人数は10名以下で入力してください'),
  note: z
    .string()
    .optional(),
})

type WaitlistFormValues = z.infer<typeof waitlistSchema>

export default function WaitlistPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [, setConfirmedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [position, setPosition] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      participant_count: 1,
    },
  })

  useEffect(() => {
    async function fetchData() {
      if (!eventId) return

      try {
        setLoading(true)
        const [eventData, count] = await Promise.all([
          eventsApi.getEvent(eventId),
          eventsApi.getConfirmedParticipantCount(eventId),
        ])
        setEvent(eventData)
        setConfirmedCount(count)

        // If event is NOT full, redirect to reservation page
        const remaining = getRemainingCapacity(eventData.capacity, count)
        if (remaining > 0) {
          navigate(`/events/${eventId}/reserve`, { replace: true })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [eventId, navigate])

  async function onSubmit(formData: WaitlistFormValues) {
    if (!event || !eventId) return

    try {
      setSubmitting(true)
      setSubmitError(null)

      await waitlistsApi.createWaitlistEntry({
        event_id: eventId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        participant_count: formData.participant_count,
        note: formData.note ?? null,
      })

      // Get current position
      const waitlistCount = await waitlistsApi.getWaitlistCount(eventId)
      setPosition(waitlistCount)
      setSuccess(true)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'キャンセル待ち登録に失敗しました。もう一度お試しください。'
      )
    } finally {
      setSubmitting(false)
    }
  }

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
            <Link to="/" className="text-blue-600 hover:underline">
              イベント一覧に戻る
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (!event.is_accepting) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h2 className="mb-2 text-lg font-semibold text-gray-900">受付を終了しました</h2>
            <p className="text-gray-600">現在、このイベントのキャンセル待ちは受け付けておりません。</p>
            <Link
              to={`/events/${event.id}`}
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              イベント詳細に戻る
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              キャンセル待ちに登録しました
            </h2>
            {position && (
              <p className="mb-4 text-lg text-gray-700">
                現在の待ち順位: <span className="font-bold text-blue-600">{position}番目</span>
              </p>
            )}
            <p className="text-gray-600">
              空きが出た場合、管理者が繰り上げを行います。
              <br />
              繰り上げが確定しましたらご連絡いたします。
            </p>
            <Link
              to={`/events/${event.id}`}
              className="mt-6 inline-block text-blue-600 hover:underline"
            >
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

      <h1 className="mb-2 text-2xl font-bold text-gray-900">キャンセル待ち登録</h1>
      <p className="mb-2 text-gray-600">{event.title}</p>
      <div className="mb-8 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
        <p className="text-sm text-yellow-800">
          現在このイベントは満席です。キャンセル待ちに登録すると、空きが出た場合に繰り上げのご連絡をいたします。
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">お客様情報</h2>

          <div className="space-y-4">
            <Input
              label="氏名"
              required
              placeholder="山田 太郎"
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="メールアドレス"
              type="email"
              required
              placeholder="example@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="電話番号"
              type="tel"
              required
              placeholder="090-1234-5678"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="参加人数"
              type="number"
              required
              min={1}
              max={10}
              error={errors.participant_count?.message}
              {...register('participant_count', { valueAsNumber: true })}
            />

            <Textarea
              label="備考"
              placeholder="ご質問やご要望がありましたらご記入ください"
              rows={3}
              error={errors.note?.message}
              {...register('note')}
            />
          </div>
        </Card>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
          loading={submitting}
          disabled={submitting}
        >
          キャンセル待ちに登録する
        </Button>
      </form>
    </div>
  )
}
