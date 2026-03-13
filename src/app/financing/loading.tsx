import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Loading() {
  return (
    <div className="container max-w-5xl py-8">
      <LoadingSpinner message="Loading financing details..." />
    </div>
  )
}
