import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal } from './Modal'

interface ConfirmOptions {
  title: string
  message: ReactNode
  okLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

/** const confirm = useConfirm(); if (await confirm({...})) { ... } の形で使う確認ダイアログ */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setPending({ ...opts, resolve })), [])

  const close = (v: boolean) => {
    pending?.resolve(v)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <Modal
          title={pending.title}
          onClose={() => close(false)}
          footer={
            <>
              <span className="spacer" />
              {/* 削除などの危険な操作では、誤って Enter で実行しないようキャンセルにフォーカス */}
              <button type="button" className="btn" onClick={() => close(false)} data-autofocus={pending.danger || undefined}>
                キャンセル
              </button>
              <button
                type="button"
                className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
                data-autofocus={!pending.danger || undefined}
              >
                {pending.okLabel ?? 'OK'}
              </button>
            </>
          }
        >
          <div className="confirm-message">{pending.message}</div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
