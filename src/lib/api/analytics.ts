import { supabase } from '@/lib/supabase'

/** 指定日数前の日付文字列を取得 */
function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

/** 日別PV数 */
export async function getDailyPageViews(days: number): Promise<Array<{ date: string; count: number }>> {
  const since = daysAgo(days)
  const { data, error } = await supabase
    .from('page_views')
    .select('created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`PV取得に失敗しました: ${error.message}`)

  // 日別に集計
  const counts: Record<string, number> = {}
  for (const row of data) {
    const date = row.created_at.slice(0, 10)
    counts[date] = (counts[date] ?? 0) + 1
  }

  // 空の日も含めて連続した日付リストを生成
  const result: Array<{ date: string; count: number }> = []
  const start = new Date(since)
  const end = new Date()
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    result.push({ date: dateStr, count: counts[dateStr] ?? 0 })
  }

  return result
}

/** 流入元別の内訳 */
export async function getReferrerStats(days: number): Promise<Array<{ source: string; count: number }>> {
  const since = daysAgo(days)
  const { data, error } = await supabase
    .from('page_views')
    .select('referrer_source')
    .gte('created_at', since)

  if (error) throw new Error(`流入元統計の取得に失敗しました: ${error.message}`)

  const counts: Record<string, number> = {}
  for (const row of data) {
    const source = row.referrer_source ?? 'unknown'
    counts[source] = (counts[source] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
}

/** ページ別PVランキング */
export async function getPopularPages(days: number): Promise<Array<{ path: string; count: number }>> {
  const since = daysAgo(days)
  const { data, error } = await supabase
    .from('page_views')
    .select('path')
    .gte('created_at', since)

  if (error) throw new Error(`ページ別PVの取得に失敗しました: ${error.message}`)

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.path] = (counts[row.path] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
}

/** 合計PV数 */
export async function getTotalPageViews(days: number): Promise<number> {
  const since = daysAgo(days)
  const { count, error } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)

  if (error) throw new Error(`PV数の取得に失敗しました: ${error.message}`)
  return count ?? 0
}

/** 本日のPV数 */
export async function getTodayPageViews(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const { count, error } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`)

  if (error) throw new Error(`本日PV数の取得に失敗しました: ${error.message}`)
  return count ?? 0
}

/** 流入元ラベル */
export const REFERRER_SOURCE_LABELS: Record<string, string> = {
  direct: '直接アクセス',
  twitter: 'X (Twitter)',
  google: 'Google検索',
  yahoo: 'Yahoo!検索',
  facebook: 'Facebook',
  instagram: 'Instagram',
  line: 'LINE',
  qr: 'QRコード',
  unknown: '不明',
}

export function getReferrerLabel(source: string): string {
  return REFERRER_SOURCE_LABELS[source] ?? source
}
