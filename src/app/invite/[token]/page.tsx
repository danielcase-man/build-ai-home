import InviteAcceptClient from './InviteAcceptClient'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InviteAcceptPage({ params }: InvitePageProps) {
  const { token } = await params

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <InviteAcceptClient token={token} />
    </div>
  )
}
