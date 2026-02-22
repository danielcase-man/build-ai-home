import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Loading() {
  return (
    <div className="container py-8">
      <LoadingSpinner message="Loading dashboard..." />
    </div>
  )
}
