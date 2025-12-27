import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

type Props = {
  canJoin: boolean
  onJoin: () => void
  loading?: boolean
}

export function JoinButton({ canJoin, onJoin, loading }: Props) {
  if (!canJoin) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Turnuvaya katıldınız</span>
      </div>
    )
  }

  return (
    <Button 
      onClick={onJoin} 
      size="lg"
      className="w-full sm:w-auto"
      disabled={loading}
    >
      {loading ? (
        <>
          <span className="animate-spin">⏳</span>
          Katılıyor...
        </>
      ) : (
        "Turnuvaya Katıl"
      )}
    </Button>
  )
}
