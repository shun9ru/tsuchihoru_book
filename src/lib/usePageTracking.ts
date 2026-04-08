import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/** referrer から流入元を判別 */
function detectReferrerSource(referrer: string, utmSource: string | null): string {
  // UTM パラメータが最優先
  if (utmSource) return utmSource

  if (!referrer) return 'direct'

  try {
    const hostname = new URL(referrer).hostname
    if (hostname.match(/t\.co|x\.com|twitter\.com/)) return 'twitter'
    if (hostname.match(/google\./)) return 'google'
    if (hostname.match(/yahoo\./)) return 'yahoo'
    if (hostname.match(/facebook\.com|fb\.com/)) return 'facebook'
    if (hostname.match(/instagram\.com/)) return 'instagram'
    if (hostname.match(/line\.me/)) return 'line'
    return hostname
  } catch {
    return 'other'
  }
}

/** ページ遷移を自動トラッキングするフック */
export function usePageTracking() {
  const location = useLocation()
  const lastTrackedPath = useRef<string>('')

  useEffect(() => {
    // 管理画面は記録しない
    if (location.pathname.startsWith('/admin')) return

    // 同じパスの重複記録を防止
    const fullPath = location.pathname + location.search
    if (fullPath === lastTrackedPath.current) return
    lastTrackedPath.current = fullPath

    const params = new URLSearchParams(location.search)
    const utmSource = params.get('utm_source')
    const utmMedium = params.get('utm_medium')
    const utmCampaign = params.get('utm_campaign')
    const referrer = document.referrer
    const referrerSource = detectReferrerSource(referrer, utmSource)

    supabase.from('page_views').insert({
      path: location.pathname,
      referrer: referrer || null,
      referrer_source: referrerSource,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      user_agent: navigator.userAgent,
    }).then(({ error }) => {
      if (error) console.error('Page view tracking failed:', error.message)
    })
  }, [location.pathname, location.search])
}
