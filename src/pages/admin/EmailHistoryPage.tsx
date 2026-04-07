import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import EventTabs from '@/components/admin/EventTabs'
import { Mail, ChevronDown, ChevronUp, ArrowLeft, MailPlus } from 'lucide-react'
import { emailsApi, eventsApi } from '@/lib/api'
import { Button, Card, Badge, LoadingSpinner, Modal, EmptyState } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { EMAIL_STATUS_LABELS, SEND_STATUS_LABELS } from '@/lib/constants'
import type { Event, BulkEmail, BulkEmailLog } from '@/types'

function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'sent':
      return 'success'
    case 'sending':
      return 'info'
    case 'failed':
      return 'danger'
    case 'draft':
      return 'default'
    default:
      return 'default'
  }
}

function getSendStatusBadgeVariant(status: string): 'success' | 'danger' | 'default' {
  switch (status) {
    case 'sent':
      return 'success'
    case 'failed':
      return 'danger'
    default:
      return 'default'
  }
}

export default function EmailHistoryPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const [event, setEvent] = useState<Event | null>(null)
  const [emails, setEmails] = useState<BulkEmail[]>([])
  const [loading, setLoading] = useState(true)

  // Detail view state
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<BulkEmail | null>(null)
  const [logs, setLogs] = useState<BulkEmailLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Expanded card IDs (inline expand mode)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    if (!eventId) return
    try {
      setLoading(true)
      const [eventData, emailsData] = await Promise.all([
        eventsApi.getEvent(eventId),
        emailsApi.getBulkEmails(eventId),
      ])
      setEvent(eventData)
      setEmails(emailsData)
    } catch (err) {
      console.error('データの取得に失敗しました:', err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Open detail modal
  async function handleOpenDetail(email: BulkEmail) {
    setSelectedEmail(email)
    setDetailModalOpen(true)
    setLogs([])

    try {
      setLogsLoading(true)
      const logsData = await emailsApi.getBulkEmailLogs(email.id)
      setLogs(logsData)
    } catch (err) {
      console.error('配信ログの取得に失敗しました:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Compute log summary
  function getLogSummary(logEntries: BulkEmailLog[]) {
    const total = logEntries.length
    const sentCount = logEntries.filter((l) => l.send_status === 'sent').length
    const failedCount = logEntries.filter((l) => l.send_status === 'failed').length
    const pendingCount = logEntries.filter((l) => l.send_status === 'pending').length
    return { total, sentCount, failedCount, pendingCount }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="py-20 text-center text-gray-500">
        イベントが見つかりませんでした
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link
              to={`/admin/events/${eventId}/emails`}
              className="text-gray-400 transition hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">配信履歴</h1>
          </div>
          <p className="ml-7 text-sm text-gray-500">{event.title}</p>
        </div>
        <Link to={`/admin/events/${eventId}/emails`}>
          <Button variant="primary" size="sm">
            <MailPlus className="mr-1.5 h-4 w-4" />
            新規メール作成
          </Button>
        </Link>
      </div>
      <div className="mb-6"><EventTabs /></div>

      {/* Email list */}
      {emails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="配信履歴がありません"
          description="まだメールが送信されていません"
          action={
            <Link to={`/admin/events/${eventId}/emails`}>
              <Button variant="primary">
                <MailPlus className="mr-1.5 h-4 w-4" />
                メールを作成
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {emails.map((email) => {
            const isExpanded = expandedIds.has(email.id)

            return (
              <Card key={email.id} className="overflow-hidden">
                {/* Summary row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-900">
                        {email.subject}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(email.status)}>
                        {EMAIL_STATUS_LABELS[email.status] ?? email.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {email.sent_at && (
                        <span>送信日時: {formatDateTime(email.sent_at)}</span>
                      )}
                      {!email.sent_at && email.created_at && (
                        <span>作成日時: {formatDateTime(email.created_at)}</span>
                      )}
                      {email.target_count != null && (
                        <span>送信対象: {email.target_count}名</span>
                      )}
                    </div>

                    {/* Body preview (collapsed) */}
                    {!isExpanded && (
                      <p className="mt-2 text-sm text-gray-600">
                        {truncateText(email.body, 100)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(email)}
                    >
                      詳細
                    </Button>
                    <button
                      onClick={() => toggleExpand(email.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="mb-1 text-xs font-medium text-gray-500">本文</p>
                    <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
                      {email.body}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail modal with logs */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedEmail(null)
          setLogs([])
        }}
        title="メール配信詳細"
        size="lg"
      >
        {selectedEmail && (
          <div className="space-y-5">
            {/* Email info */}
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">件名</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedEmail.subject}
                </p>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <div>
                  <span className="text-xs text-gray-400">ステータス: </span>
                  <Badge variant={getStatusBadgeVariant(selectedEmail.status)}>
                    {EMAIL_STATUS_LABELS[selectedEmail.status] ?? selectedEmail.status}
                  </Badge>
                </div>
                {selectedEmail.sent_at && (
                  <div>
                    <span className="text-xs text-gray-400">送信日時: </span>
                    {formatDateTime(selectedEmail.sent_at)}
                  </div>
                )}
                {selectedEmail.target_count != null && (
                  <div>
                    <span className="text-xs text-gray-400">送信対象: </span>
                    {selectedEmail.target_count}名
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">本文</p>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800">
                  {selectedEmail.body}
                </div>
              </div>
            </div>

            {/* Delivery logs */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">配信ログ</h4>

              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : logs.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  配信ログはありません
                </p>
              ) : (
                <>
                  {/* Summary */}
                  {(() => {
                    const summary = getLogSummary(logs)
                    return (
                      <div className="mb-3 flex flex-wrap gap-3 rounded-lg bg-gray-50 p-3 text-xs">
                        <span className="text-gray-600">
                          合計: <span className="font-semibold">{summary.total}件</span>
                        </span>
                        <span className="text-green-700">
                          送信済: <span className="font-semibold">{summary.sentCount}件</span>
                        </span>
                        <span className="text-red-700">
                          失敗: <span className="font-semibold">{summary.failedCount}件</span>
                        </span>
                        {summary.pendingCount > 0 && (
                          <span className="text-gray-500">
                            未送信: <span className="font-semibold">{summary.pendingCount}件</span>
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  {/* Log table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500">
                            メールアドレス
                          </th>
                          <th className="whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500">
                            ステータス
                          </th>
                          <th className="whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500">
                            エラー
                          </th>
                          <th className="whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500">
                            送信日時
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-2 text-gray-800">
                              {log.email}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2">
                              <Badge variant={getSendStatusBadgeVariant(log.send_status)}>
                                {SEND_STATUS_LABELS[log.send_status] ?? log.send_status}
                              </Badge>
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-2 text-xs text-red-600">
                              {log.error_message ?? '-'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">
                              {log.created_at ? formatDateTime(log.created_at) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDetailModalOpen(false)
                  setSelectedEmail(null)
                  setLogs([])
                }}
              >
                閉じる
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
