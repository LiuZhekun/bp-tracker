export type ViewId = 'home' | 'add' | 'chart' | 'history'

type Props = {
  current: ViewId
  onChange: (v: ViewId) => void
}

const items: { id: ViewId; icon: string; label: string }[] = [
  { id: 'home', icon: 'home', label: '首页' },
  { id: 'add', icon: 'mic', label: '录入' },
  { id: 'chart', icon: 'trending_up', label: '趋势' },
  { id: 'history', icon: 'history', label: '历史' },
]

export function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="主导航">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={'tab-btn' + (current === it.id ? ' active' : '')}
          onClick={() => onChange(it.id)}
        >
          <span className="material-symbols-outlined tab-icon">{it.icon}</span>
          <span className="tab-label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
