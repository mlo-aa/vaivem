import { ClaimLoader } from "@/components/claim/claim-loader"

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <ClaimLoader token={token} />
}
