import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Card, Input } from '@/components/ui'
import { customerLoginSchema, type CustomerLoginFormValues } from '@/lib/validations'

export default function CustomerLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/mypage'
  const { isCustomer, isAdmin, loading: authLoading, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerLoginFormValues>({
    resolver: zodResolver(customerLoginSchema),
  })

  useEffect(() => {
    if (!authLoading && isCustomer) {
      navigate(redirectTo, { replace: true })
    }
    if (!authLoading && isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [isCustomer, isAdmin, authLoading, navigate, redirectTo])

  const onSubmit = async (data: CustomerLoginFormValues) => {
    setError(null)
    try {
      await signIn(data.email, data.password)
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません')
    }
  }

  if (authLoading) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ログイン</h1>
          <p className="mt-2 text-sm text-gray-600">アカウントにログインしてください</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              placeholder="パスワードを入力"
              error={errors.password?.message}
              required
              {...register('password')}
            />

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              ログイン
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            アカウントをお持ちでない方は
            <Link to={`/register${redirectTo !== '/mypage' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="ml-1 font-medium text-blue-600 hover:text-blue-500">
              新規登録
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
