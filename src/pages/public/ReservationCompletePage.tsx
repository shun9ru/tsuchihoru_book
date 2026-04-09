import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Button, Card } from '@/components/ui'

export default function ReservationCompletePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card className="text-center">
        <Clock className="mx-auto mb-4 h-16 w-16 text-yellow-500" />

        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          ご予約を受け付けました
        </h1>

        <p className="mb-6 text-lg text-gray-600">
          管理者の承認後、予約が確定します。
        </p>

        <div className="mb-8 rounded-lg bg-yellow-50 p-4 text-left">
          <ul className="space-y-2 text-sm text-gray-700">
            <li>ご予約は現在「承認待ち」の状態です。</li>
            <li>管理者が確認後、承認または却下の結果をメールでお知らせします。</li>
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
