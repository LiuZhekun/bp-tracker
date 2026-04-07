type Props = {
  message: string | null
}

export function Toast({ message }: Props) {
  return (
    <div id="toast" className={'toast' + (message ? '' : ' hidden')} role="status">
      {message}
    </div>
  )
}
