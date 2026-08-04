import { WalletView } from "@/components/wallet/wallet-view"
import { ClaimShell } from "@/components/claim/claim-shell"

export const metadata = {
  title: "Your Wallet · ClaimLink",
}

export default function WalletPage() {
  return (
    <ClaimShell>
      <div className="w-full py-4">
        <WalletView />
      </div>
    </ClaimShell>
  )
}
