import * as React from "react"

export function useFileDragAndDrop(onFileSelected: (file: File) => void) {
  const [dragActive, setDragActive] = React.useState(false)

  const handleDrag = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0])
    }
  }, [onFileSelected])

  return {
    dragActive,
    handleDrag,
    handleDrop,
    setDragActive,
  }
}
