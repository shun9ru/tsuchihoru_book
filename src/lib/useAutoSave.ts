import { useEffect, useRef, useState, useCallback } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * 自動保存フック
 * @param saveFn 保存関数（Promiseを返す）
 * @param deps 変更を監視する依存配列
 * @param delay デバウンス遅延（ms）
 * @param enabled 自動保存を有効にするか
 */
export function useAutoSave(
  saveFn: () => Promise<void>,
  deps: unknown[],
  delay = 2000,
  enabled = true,
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isFirstRender = useRef(true)
  const saveFnRef = useRef(saveFn)
  saveFnRef.current = saveFn

  const save = useCallback(async () => {
    try {
      setStatus('saving')
      await saveFnRef.current()
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    // 初回レンダリングはスキップ
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!enabled) return

    setStatus('idle')
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(save, delay)

    return () => clearTimeout(timeoutRef.current)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return status
}
