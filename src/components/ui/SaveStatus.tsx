import { Check, Loader2, AlertCircle } from 'lucide-react'

interface SaveStatusProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export default function SaveStatus({ status }: SaveStatusProps) {
  if (status === 'idle') return null

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          <span className="text-blue-500">保存中...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-green-500">保存済み</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span className="text-red-500">保存失敗</span>
        </>
      )}
    </span>
  )
}
