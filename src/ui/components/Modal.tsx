import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** 画面中央(スマホでは下から)に出るダイアログ */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) {
      d.showModal()
      // showModal は最初のボタン(×)にフォーカスを移すため、data-autofocus の要素を明示的にフォーカスする
      const target = d.querySelector<HTMLElement>('[data-autofocus]')
      if (target) target.focus()
      else d.focus()
    }
    return () => d?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  )
}

interface FormModalProps {
  title: string
  onClose: () => void
  onSubmit: () => void
  children: ReactNode
  submitLabel?: string
  /** 編集時に表示する削除ボタンの処理 */
  onDelete?: () => void
}

/** 入力フォーム用のダイアログ(保存・キャンセル・削除ボタン付き) */
export function FormModal({ title, onClose, onSubmit, children, submitLabel = '保存', onDelete }: FormModalProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {children}
        <div className="form-actions">
          {onDelete && (
            <button type="button" className="btn btn-danger-ghost" onClick={onDelete}>
              削除
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
