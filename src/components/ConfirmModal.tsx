type Props = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, onConfirm, onCancel }: Props) {
  return (
    <div id="confirm-modal" className={'modal-overlay' + (open ? '' : ' hidden')}>
      <div className="modal-sheet card card--elevated">
        <p className="modal-msg">确认删除这条记录？</p>
        <button type="button" id="confirm-ok" className="modal-del-btn" onClick={onConfirm}>
          删除
        </button>
        <button type="button" id="confirm-cancel" className="modal-cancel-btn" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  )
}
