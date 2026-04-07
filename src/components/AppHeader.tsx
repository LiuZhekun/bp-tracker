type Props = {
  onSettings?: () => void
}

export function AppHeader({ onSettings }: Props) {
  return (
    <header className="app-top-bar">
      <div className="app-top-bar__inner">
        <div className="app-top-bar__avatar" aria-hidden="true">
          <span className="material-symbols-outlined">person</span>
        </div>
        <h1 className="app-top-bar__title">血压记录</h1>
        <button
          type="button"
          className="app-top-bar__settings"
          aria-label="设置"
          title="设置"
          onClick={onSettings}
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  )
}
