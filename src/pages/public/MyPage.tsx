import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, Calendar, MapPin } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { customersApi } from '@/lib/api'
import { Button, Card, Input, Select, Badge, LoadingSpinner, EmptyState } from '@/components/ui'
import { customerProfileSchema, type CustomerProfileFormValues } from '@/lib/validations'
import { AGE_GROUP_OPTIONS, PREFECTURE_OPTIONS, RESERVATION_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

interface ReservationWithEvent {
  id: string
  event_id: string
  status: string
  participant_count: number
  created_at: string
  events: {
    id: string
    title: string
    event_date: string
    start_time: string
    end_time: string
    location: string
  } | null
}

export default function MyPage() {
  const { customer, refreshCustomer } = useAuth()
  const [reservations, setReservations] = useState<ReservationWithEvent[]>([])
  const [loadingReservations, setLoadingReservations] = useState(true)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerProfileFormValues>({
    resolver: zodResolver(customerProfileSchema),
  })

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        prefecture: customer.prefecture ?? '',
        age_group: customer.age_group ?? '',
      })
      loadReservations(customer.id, customer.email)
    }
  }, [customer, reset])

  async function loadReservations(customerId: string, email: string) {
    try {
      const data = await customersApi.getCustomerReservations(customerId, email)
      setReservations(data as ReservationWithEvent[])
    } catch (err) {
      console.error('予約履歴の取得に失敗しました:', err)
    } finally {
      setLoadingReservations(false)
    }
  }

  const onSubmit = async (data: CustomerProfileFormValues) => {
    if (!customer) return
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await customersApi.updateCustomer(customer.id, {
        name: data.name,
        prefecture: data.prefecture || null,
        age_group: data.age_group || null,
      })
      await refreshCustomer()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
    }
  }

  if (!customer) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success' as const
      case 'attended': return 'info' as const
      case 'cancelled': return 'default' as const
      case 'no_show': return 'danger' as const
      default: return 'default' as const
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>

      {/* Profile */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">プロフィール</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="氏名"
            error={errors.name?.message}
            required
            {...register('name')}
          />

          <div className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">メールアドレス</span>
            <span className="text-gray-600">{customer.email}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="お住まいの都道府県"
              options={PREFECTURE_OPTIONS}
              placeholder="選択してください"
              {...register('prefecture')}
            />

            <Select
              label="年代"
              options={AGE_GROUP_OPTIONS}
              placeholder="選択してください"
              {...register('age_group')}
            />
          </div>

          {saveError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
          )}

          {saveSuccess && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">プロフィールを更新しました</div>
          )}

          <Button type="submit" loading={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </form>
      </Card>

      {/* Reservation History */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">予約履歴</h2>

        {loadingReservations ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : reservations.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="予約履歴がありません"
            description="イベントに予約すると、ここに履歴が表示されます。"
            action={
              <Link to="/">
                <Button variant="secondary">イベント一覧を見る</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {reservations.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">
                    {r.events?.title ?? '(イベント不明)'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    {r.events && (
                      <>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(r.events.event_date)}
                          {' '}
                          {r.events.start_time.slice(0, 5)}〜{r.events.end_time.slice(0, 5)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {r.events.location}
                        </span>
                      </>
                    )}
                    <span>{r.participant_count}名</span>
                  </div>
                </div>
                <Badge variant={statusVariant(r.status)}>
                  {RESERVATION_STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
