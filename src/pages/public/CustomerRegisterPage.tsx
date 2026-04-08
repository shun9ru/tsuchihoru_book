import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Card, Input, Select } from '@/components/ui'
import { customerRegisterSchema, type CustomerRegisterFormValues } from '@/lib/validations'
import { AGE_GROUP_OPTIONS, PREFECTURE_OPTIONS } from '@/lib/constants'

export default function CustomerRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/mypage'
  const { isCustomer, loading: authLoading, signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerRegisterFormValues>({
    resolver: zodResolver(customerRegisterSchema),
  })

  useEffect(() => {
    if (!authLoading && isCustomer) {
      navigate(redirectTo, { replace: true })
    }
  }, [isCustomer, authLoading, navigate])

  const onSubmit = async (data: CustomerRegisterFormValues) => {
    setError(null)
    try {
      await signUp({
        email: data.email,
        password: data.password,
        name: data.name,
        prefecture: data.prefecture,
        age_group: data.age_group,
      })
      setRegisteredEmail(data.email)
      setRegistered(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アカウント登録に失敗しました')
    }
  }

  if (authLoading) {
    return null
  }

  if (registered) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <Card>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">確認メールを送信しました</h2>
              <p className="mt-3 text-sm text-gray-600">
                <span className="font-medium text-gray-900">{registeredEmail}</span>
                {' '}宛に確認メールを送信しました。
              </p>
              <p className="mt-2 text-sm text-gray-600">
                メール内のリンクをクリックして、アカウント登録を完了してください。
              </p>
              <div className="mt-6">
                <Link to={`/login${redirectTo !== '/mypage' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}>
                  <Button variant="secondary" className="w-full">
                    ログイン画面へ
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">アカウント登録</h1>
          <p className="mt-2 text-sm text-gray-600">予約履歴の確認や次回予約がスムーズになります</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="氏名"
              placeholder="山田 太郎"
              error={errors.name?.message}
              required
              {...register('name')}
            />

            <Input
              label="メールアドレス"
              type="email"
              placeholder="example@email.com"
              error={errors.email?.message}
              required
              {...register('email')}
            />

            <Input
              label="パスワード"
              type="password"
              placeholder="6文字以上"
              error={errors.password?.message}
              required
              {...register('password')}
            />

            <Input
              label="パスワード確認"
              type="password"
              placeholder="もう一度入力"
              error={errors.confirmPassword?.message}
              required
              {...register('confirmPassword')}
            />

            <Select
              label="お住まいの都道府県"
              options={PREFECTURE_OPTIONS}
              placeholder="選択してください"
              error={errors.prefecture?.message}
              {...register('prefecture')}
            />

            <Select
              label="年代"
              options={AGE_GROUP_OPTIONS}
              placeholder="選択してください"
              error={errors.age_group?.message}
              {...register('age_group')}
            />

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              登録する
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            すでにアカウントをお持ちの方は
            <Link to={`/login${redirectTo !== '/mypage' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="ml-1 font-medium text-blue-600 hover:text-blue-500">
              ログイン
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
