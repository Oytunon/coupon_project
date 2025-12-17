type Props = {
  canJoin: boolean
  onJoin: () => void
}

export function JoinButton({ canJoin, onJoin }: Props) {
  if (!canJoin) {
    return <p>✅ Turnuvaya katıldınız</p>
  }

  return (
    <button onClick={onJoin}>
      Katıl
    </button>
  )
}
