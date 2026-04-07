import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Card, Input } from '@/components/ui'
import { loginSchema, type LoginFormValues } from '@/lib/validations'
import { APP_NAME } from '@/lib/constants'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/admin', { replace: true })
    }
  }, [user, authLoading, navigate])

  const onSubmit = async (data: LoginFormValues) => {
    setError(null)
    try {
      await signIn(data.email, data.password)
      navigate('/admin', { replace: true })
    } catch (err) {
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
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-gray-600">管理画面ログイン</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="メールアドレス"
              type="email"
              placeholder="admin@example.com"
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

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full"
            >
              <LogIn className="mr-2 h-4 w-4" />
              ログイン
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
