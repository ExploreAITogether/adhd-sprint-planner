import type { ReactNode, RefObject } from 'react'
import { CloseIcon } from './icons'

interface ModalShellProps {
  modalRef: RefObject<HTMLDivElement | null>
  isClosing: boolean
  /** Animated close — called by the close button and by backdrop clicks. */
  onClose: () => void
  labelledBy: string
  /** Tailwind max-width class for the panel, e.g. "max-w-[440px]". */
  widthClass: string
  children: ReactNode
}

// Shared backdrop + panel chrome for every modal. Behaviour that differs per
// modal (focus trap, keyboard shortcuts, close timing) stays in the caller.
export default function ModalShell({
  modalRef,
  isClosing,
  onClose,
  labelledBy,
  widthClass,
  children,
}: ModalShellProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && e.target instanceof Node && !modalRef.current.contains(e.target)) {
      onClose()
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-5
        ${isClosing ? 'animate-[modal-fade-out_150ms_ease-in_forwards]' : 'animate-[modal-fade-in_200ms_ease-out]'}`}
      onClick={handleBackdropClick}
    >
      <div className="modal-backdrop" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`modal-panel ${widthClass}
          ${isClosing ? 'animate-[modal-scale-out_150ms_ease-in_forwards]' : 'animate-[modal-scale-in_240ms_cubic-bezier(0.22,1,0.36,1)]'}`}
      >
        <button onClick={onClose} aria-label="Close" className="icon-btn absolute top-4 right-4 z-10">
          <CloseIcon size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}
