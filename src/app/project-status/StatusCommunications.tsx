'use client'

import { MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  communications: Array<{ from: string; summary: string }>
}

export default function StatusCommunications({ communications }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          Recent Discussions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {communications.length > 0 ? communications.map((comm, index) => (
          <div key={index} className="border-l-4 border-primary pl-3">
            <p className="text-sm font-medium">{comm.from}</p>
            <p className="text-sm text-muted-foreground">{comm.summary}</p>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">No recent email discussions. Sync your Gmail to see communications here.</p>
        )}
      </CardContent>
    </Card>
  )
}
