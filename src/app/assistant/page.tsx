import AssistantChat from './AssistantChat'

export const metadata = {
  title: 'Project Assistant | UBuildIt Manager',
}

export default function AssistantPage() {
  return (
    <main className="container max-w-4xl py-6">
      <AssistantChat />
    </main>
  )
}
