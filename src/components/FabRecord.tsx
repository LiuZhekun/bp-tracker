type Props = {
  visible: boolean
  onClick: () => void
}

export function FabRecord({ visible, onClick }: Props) {
  return (
    <button
      type="button"
      id="fab-record"
      className={'fab-record' + (visible ? '' : ' hidden')}
      aria-label="快速录入"
      onClick={onClick}
    >
      <span className="material-symbols-outlined fab-record__icon">mic</span>
      <span className="fab-record__label">录入</span>
    </button>
  )
}
