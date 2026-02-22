import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Loading() {
  return (
    <div className="container max-w-6xl py-8">
      <LoadingSpinner message="Loading selections..." />
    </div>
  )
}
