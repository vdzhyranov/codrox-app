import { useState, useEffect } from 'react'

interface UsePTYFileDropOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  ptyId: string
  formatPath: (path: string) => string
}

export function usePTYFileDrop({ containerRef, ptyId, formatPath }: UsePTYFileDropOptions): {
  isDragging: boolean
} {
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onDragOver = (e: DragEvent): void => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragging(true)
    }

    const onDragLeave = (e: DragEvent): void => {
      // Only clear if leaving the container entirely (not entering a child)
      if (container.contains(e.relatedTarget as Node)) return
      setIsDragging(false)
    }

    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      const paths = Array.from(files)
        .map((f) => (f as File & { path?: string }).path ?? f.name)
        .filter(Boolean)
        .map(formatPath)
        .join(' ')

      if (paths) {
        window.api.invoke('pty:write', { id: ptyId, data: paths })
      }
    }

    container.addEventListener('dragover', onDragOver)
    container.addEventListener('dragleave', onDragLeave)
    container.addEventListener('drop', onDrop)

    return () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('dragleave', onDragLeave)
      container.removeEventListener('drop', onDrop)
    }
  }, [containerRef, ptyId, formatPath])

  return { isDragging }
}
