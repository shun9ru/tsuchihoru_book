import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { Button, Card } from '@/components/ui'

export default function ReservationCompletePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card className="text-center">
        <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />

        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          ご予約ありがとうございます
        </h1>

        <p className="mb-6 text-lg text-gray-600">
          確認メールをお送りしました。
        </p>

        <div className="mb-8 rounded-lg bg-gray-50 p-4 text-left">
          <ul className="space-y-2 text-sm text-gray-700">
            <li>ご登録いただいたメールアドレスに予約確認メールをお送りしています。</li>
            <li>メールが届かない場合は、迷惑メールフォルダをご確認ください。</li>
            <li>ご不明な点がございましたら、お気軽にお問い合わせください。</li>
          </ul>
        </div>

        <Link to="/">
          <Button variant="secondary" size="lg">
            イベント一覧に戻る
          </Button>
        </Link>
      </Card>
    </div>
  )
}
