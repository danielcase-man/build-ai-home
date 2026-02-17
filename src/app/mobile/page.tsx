import React from 'react'
import MobileLayout from '@/components/mobile/MobileLayout'
import JobSiteDashboard from '@/components/mobile/JobSiteDashboard'

export default function MobilePage() {
  return (
    <MobileLayout title="Job Site Dashboard">
      <JobSiteDashboard />
    </MobileLayout>
  )
}
