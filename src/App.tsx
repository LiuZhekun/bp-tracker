import { useCallback, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { BottomNav, type ViewId } from './components/BottomNav'
import { ConfirmModal } from './components/ConfirmModal'
import { FabRecord } from './components/FabRecord'
import { Toast } from './components/Toast'
import { HomePage } from './app/pages/HomePage'
import { AddPage } from './app/pages/AddPage'
import { ChartPage } from './app/pages/ChartPage'
import { HistoryPage } from './app/pages/HistoryPage'
import { Storage } from './lib/storage'

export default function App() {
  const [view, setView] = useState<ViewId>('home')
  const [refreshTick, setRefreshTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [fabVoiceGen, setFabVoiceGen] = useState(0)

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }, [])

  const switchView = (v: ViewId) => setView(v)

  const onFab = () => {
    setFabVoiceGen((g) => g + 1)
    setView('add')
  }

  return (
    <>
      <AppHeader onSettings={() => showToast('设置功能即将推出')} />

      <div id="view-home" className={'view view--with-global-header' + (view === 'home' ? ' active' : '')}>
        <HomePage refreshTick={refreshTick} />
      </div>

      <div id="view-add" className={'view view--with-global-header' + (view === 'add' ? ' active' : '')}>
        <AddPage onSaved={refresh} showToast={showToast} fabVoiceGen={fabVoiceGen} />
      </div>

      <div id="view-chart" className={'view view--with-global-header' + (view === 'chart' ? ' active' : '')}>
        <ChartPage refreshTick={refreshTick} />
      </div>

      <div id="view-history" className={'view view--with-global-header' + (view === 'history' ? ' active' : '')}>
        <HistoryPage
          refreshTick={refreshTick}
          onRefresh={refresh}
          showToast={showToast}
          onRequestDelete={setPendingDeleteId}
        />
      </div>

      <FabRecord visible={view === 'home'} onClick={onFab} />
      <BottomNav current={view} onChange={switchView} />
      <Toast message={toast} />

      <ConfirmModal
        open={pendingDeleteId !== null}
        onConfirm={() => {
          if (pendingDeleteId) {
            Storage.remove(pendingDeleteId)
            setPendingDeleteId(null)
            refresh()
            showToast('已删除')
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  )
}
