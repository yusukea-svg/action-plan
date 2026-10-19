import { useRef, useState } from 'react'
import { daysBetween, formatDateTime } from '../../domain/dates'
import { importStats, type ImportMode } from '../../domain/merge'
import { COLLECTION_LABELS, COLLECTIONS, type AppData } from '../../domain/types'
import { downloadJson, parseJson } from '../../io/json'
import { actions, useAppData, useLocalMeta } from '../../store/store'
import { useConfirm } from '../components/Confirm'
import { Segmented } from '../components/Fields'

interface Loaded {
  fileName: string
  data: AppData
}

export function DataPage() {
  const data = useAppData()
  const meta = useLocalMeta()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // SheetJS は大きいので、Excel を使うときだけ読み込む
  const loadExcel = () => import('../../io/excel')

  const exportExcel = async () => {
    const { downloadExcel } = await loadExcel()
    downloadExcel(data)
    actions.markBackedUp()
    setMessage({ type: 'ok', text: 'Excelファイルを書き出しました。' })
  }
  const exportJson = () => {
    downloadJson(data)
    actions.markBackedUp()
    setMessage({ type: 'ok', text: 'JSONバックアップを書き出しました。' })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    try {
      const isJson = file.name.toLowerCase().endsWith('.json')
      const incoming = isJson ? parseJson(await file.text()) : (await loadExcel()).readWorkbook(await file.arrayBuffer())
      setLoaded({ fileName: file.name, data: incoming })
      setMode('merge')
    } catch (e) {
      setLoaded(null)
      setMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const stats = loaded ? importStats(data, loaded.data, mode) : null

  const runImport = async () => {
    if (!loaded || !stats) return
    const ok = await confirm({
      title: mode === 'replace' ? '全置換で読み込み' : '統合して読み込み',
      message:
        mode === 'replace' ? (
          <>
            現在のデータ(案件 {data.cases.length}件)をすべて消して、「{loaded.fileName}」の内容に置き換えます。
            <br />
            <strong>元に戻せません。</strong>必要なら先にバックアップを書き出してください。
          </>
        ) : (
          <>
            「{loaded.fileName}」を現在のデータに統合します。
            <br />
            新規 {sum(stats, 'added')}件・上書き {sum(stats, 'updated')}件が反映されます。
          </>
        ),
      okLabel: '読み込む',
      danger: mode === 'replace',
    })
    if (!ok) return
    actions.importData(loaded.data, mode)
    setLoaded(null)
    setMessage({ type: 'ok', text: '読み込みが完了しました。' })
  }

  const backupAge = meta.lastBackupAt ? daysBetween(meta.lastBackupAt) : null

  return (
    <div className="page">
      <div className="page-header">
        <h1>データ管理</h1>
      </div>

      {message && <p className={`notice notice-${message.type}`}>{message.text}</p>}

      <section className="card">
        <div className="card-header">
          <h2>書き出し(バックアップ・共有)</h2>
        </div>
        <p className="muted">
          最終バックアップ:{' '}
          {meta.lastBackupAt ? (
            <strong>
              {formatDateTime(meta.lastBackupAt)}({backupAge === 0 ? '今日' : `${backupAge}日前`})
            </strong>
          ) : (
            <strong>まだありません</strong>
          )}
        </p>
        <p className="muted">
          現在のデータ:{COLLECTIONS.map((c) => `${COLLECTION_LABELS[c]} ${(data[c] as unknown[]).length}件`).join(' / ')}
        </p>
        <div className="button-row">
          <button type="button" className="btn btn-primary" onClick={exportExcel}>
            Excelに書き出し
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            JSONバックアップ
          </button>
        </div>
        <p className="field-hint">
          チームでの共有は Excel を使います。JSON はこのアプリ専用の完全バックアップです。データはこのブラウザにしか保存されていないため、定期的に書き出してください。
        </p>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>読み込み</h2>
        </div>
        <p className="muted">このアプリで書き出した Excel(.xlsx)または JSON ファイルを選んでください。</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="file-input"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {loaded && stats && (
          <div className="import-preview">
            <h3>「{loaded.fileName}」の内容</h3>
            <div className="field">
              <span className="field-label">取り込み方</span>
              <Segmented<ImportMode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'merge', label: '既存データに統合' },
                  { value: 'replace', label: '全置換' },
                ]}
              />
              <span className="field-hint">
                {mode === 'merge'
                  ? '同じIDのデータは更新日時が新しい方を採用します。手元にしか無いデータは残ります(削除は反映されません)。'
                  : '現在のデータをすべて消して、ファイルの内容に置き換えます。'}
              </span>
            </div>
            <div className="table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>種類</th>
                    <th>ファイル内</th>
                    {mode === 'merge' && (
                      <>
                        <th>新規</th>
                        <th>上書き</th>
                        <th>手元を維持</th>
                      </>
                    )}
                    <th>現在</th>
                    <th>読み込み後</th>
                  </tr>
                </thead>
                <tbody>
                  {COLLECTIONS.map((c) => (
                    <tr key={c}>
                      <th>{COLLECTION_LABELS[c]}</th>
                      <td>{stats[c].incoming}</td>
                      {mode === 'merge' && (
                        <>
                          <td className={stats[c].added ? 'em' : ''}>{stats[c].added}</td>
                          <td className={stats[c].updated ? 'em' : ''}>{stats[c].updated}</td>
                          <td>{stats[c].kept}</td>
                        </>
                      )}
                      <td>{(data[c] as unknown[]).length}</td>
                      <td>
                        <strong>{stats[c].after}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="button-row">
              <button type="button" className="btn" onClick={() => setLoaded(null)}>
                やめる
              </button>
              <button type="button" className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`} onClick={runImport}>
                {mode === 'replace' ? '全置換で読み込む' : '統合して読み込む'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function sum(stats: ReturnType<typeof importStats>, key: 'added' | 'updated'): number {
  return COLLECTIONS.reduce((n, c) => n + stats[c][key], 0)
}
