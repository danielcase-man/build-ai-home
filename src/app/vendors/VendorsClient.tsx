'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Building2,
  Users,
  Tags,
  Search,
  Mail,
  Phone,
  User,
  UserX,
  LinkIcon,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
} from 'lucide-react'

interface Vendor {
  id: string
  project_id: string
  company_name: string
  category: string | null
  status: string | null
  primary_contact: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface VendorWithContact extends Vendor {
  linked_contact: {
    id: string
    name: string
    email: string | null
    phone: string | null
    role: string | null
    company: string | null
  } | null
}

interface VendorInvitation {
  id: string
  project_id: string
  vendor_id: string | null
  email: string
  token: string
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  company: string | null
}

interface VendorsClientProps {
  vendors: VendorWithContact[]
  invitations?: VendorInvitation[]
  contacts?: Contact[]
  projectId: string
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100'
    case 'contracted':
      return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100'
    case 'completed':
      return 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'
    case 'inactive':
      return 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-100'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'
  }
}

function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'plumbing':
      return 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50'
    case 'electrical':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50'
    case 'hvac':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-50'
    case 'framing':
      return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50'
    case 'concrete':
      return 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-100'
    case 'roofing':
      return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50'
    case 'insulation':
      return 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-50'
    case 'drywall':
      return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
    case 'painting':
      return 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50'
    case 'flooring':
      return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50'
    case 'cabinets':
    case 'cabinetry':
      return 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-50'
    case 'countertops':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
    case 'windows':
    case 'windows & doors':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-50'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-50'
  }
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function VendorCard({
  vendor,
  vendorInvitations,
  onInvite,
  onLinkContact,
}: {
  vendor: VendorWithContact
  vendorInvitations: VendorInvitation[]
  onInvite: (vendorId: string, email: string) => void
  onLinkContact: (vendorId: string, currentContactId: string | null) => void
}) {
  const hasActiveInvite = vendorInvitations.some(inv => !inv.accepted_at && new Date(inv.expires_at) > new Date())
  const hasAcceptedInvite = vendorInvitations.some(inv => inv.accepted_at)
  const contact = vendor.linked_contact
  const hasLinkedContact = contact !== null

  // Resolve contact info: prefer linked contact, fall back to vendor fields
  const contactName = contact?.name ?? vendor.contact_name ?? vendor.primary_contact
  const contactEmail = contact?.email ?? vendor.contact_email
  const contactPhone = contact?.phone ?? vendor.contact_phone
  const contactRole = contact?.role

  const hasAnyContactInfo = contactName || contactEmail || contactPhone

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold leading-tight truncate">
              {vendor.company_name}
            </CardTitle>
            {contactRole && (
              <p className="text-xs text-muted-foreground mt-0.5">{contactRole}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {vendor.category && (
              <Badge className={`text-[11px] ${getCategoryColor(vendor.category)}`}>
                {vendor.category}
              </Badge>
            )}
            {vendor.status && (
              <Badge className={`text-[11px] ${getStatusColor(vendor.status)}`}>
                {formatStatus(vendor.status)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Separator className="mb-3" />

        {hasAnyContactInfo ? (
          <div className="space-y-2">
            {/* Linked contact indicator with change button */}
            <div className="flex items-center justify-between">
              {hasLinkedContact && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <LinkIcon className="h-3 w-3" />
                  Linked Contact
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-primary px-2"
                onClick={() => onLinkContact(vendor.id, contact?.id ?? null)}
              >
                Change
              </Button>
            </div>

            {contactName && (
              <div className="flex items-center gap-2 text-sm text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{contactName}</span>
              </div>
            )}

            {contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-primary hover:underline truncate"
                >
                  {contactEmail}
                </a>
              </div>
            )}

            {contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${contactPhone}`}
                  className="text-primary hover:underline"
                >
                  {contactPhone}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserX className="h-4 w-4 shrink-0" />
              <span>No contact linked</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onLinkContact(vendor.id, null)}
            >
              <LinkIcon className="h-3 w-3" />
              Link
            </Button>
          </div>
        )}

        {vendor.notes && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t line-clamp-2">
            {vendor.notes}
          </p>
        )}

        {/* Invitation status */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          {hasAcceptedInvite ? (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Portal access active
            </span>
          ) : hasActiveInvite ? (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" /> Invitation pending
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No portal access</span>
          )}
          {!hasAcceptedInvite && contactEmail && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onInvite(vendor.id, contactEmail)}
            >
              <Send className="h-3 w-3" />
              {hasActiveInvite ? 'Resend' : 'Invite'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function VendorsClient({ vendors, invitations = [], contacts = [], projectId }: VendorsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteVendorId, setInviteVendorId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Contact linking state
  const [linkVendorId, setLinkVendorId] = useState<string | null>(null)
  const [linkCurrentContactId, setLinkCurrentContactId] = useState<string | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [contactSearch, setContactSearch] = useState('')

  const invitationsByVendor = useMemo(() => {
    const map = new Map<string, VendorInvitation[]>()
    for (const inv of invitations) {
      if (!inv.vendor_id) continue
      const list = map.get(inv.vendor_id) || []
      list.push(inv)
      map.set(inv.vendor_id, list)
    }
    return map
  }, [invitations])

  const handleInvite = useCallback(async () => {
    if (!inviteVendorId || !inviteEmail.includes('@')) return
    setInviteLoading(true)
    try {
      const res = await fetch('/api/vendors/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: inviteVendorId, email: inviteEmail }),
      })
      if (res.ok) {
        setInviteEmail('')
        setInviteVendorId(null)
        setInviteDialogOpen(false)
        router.refresh()
      }
    } catch {
      // silent
    } finally {
      setInviteLoading(false)
    }
  }, [inviteVendorId, inviteEmail, router])

  const handleRevoke = useCallback(async (id: string) => {
    await fetch('/api/vendors/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }, [router])

  const copyInviteLink = useCallback((token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }, [])

  const handleLinkContact = useCallback(async (contactId: string | null) => {
    if (!linkVendorId) return
    setLinkLoading(true)
    try {
      const res = await fetch('/api/vendors/link-contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: linkVendorId, contactId }),
      })
      if (res.ok) {
        setLinkDialogOpen(false)
        setLinkVendorId(null)
        setContactSearch('')
        router.refresh()
      }
    } catch {
      // silent
    } finally {
      setLinkLoading(false)
    }
  }, [linkVendorId, router])

  const openLinkDialog = useCallback((vendorId: string, currentContactId: string | null) => {
    setLinkVendorId(vendorId)
    setLinkCurrentContactId(currentContactId)
    setContactSearch('')
    setLinkDialogOpen(true)
  }, [])

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts
    const q = contactSearch.toLowerCase()
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.role && c.role.toLowerCase().includes(q))
    )
  }, [contacts, contactSearch])

  const linkVendorName = useMemo(() => {
    if (!linkVendorId) return ''
    return vendors.find(v => v.id === linkVendorId)?.company_name || ''
  }, [linkVendorId, vendors])

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors

    const query = searchQuery.toLowerCase()
    return vendors.filter(
      (v) =>
        v.company_name.toLowerCase().includes(query) ||
        (v.category && v.category.toLowerCase().includes(query)) ||
        (v.linked_contact?.name && v.linked_contact.name.toLowerCase().includes(query)) ||
        (v.contact_name && v.contact_name.toLowerCase().includes(query)) ||
        (v.primary_contact && v.primary_contact.toLowerCase().includes(query))
    )
  }, [vendors, searchQuery])

  const summary = useMemo(() => {
    const linkedCount = vendors.filter((v) => v.linked_contact !== null).length
    const categories = new Set(vendors.map((v) => v.category).filter(Boolean))
    return {
      total: vendors.length,
      linked: linkedCount,
      categories: categories.size,
    }
  }, [vendors])

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
        <p className="text-muted-foreground">
          Vendor directory with contact information and category tracking
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Total Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Linked Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.linked}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total > 0
                ? `${Math.round((summary.linked / summary.total) * 100)}% of vendors`
                : 'No vendors yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.categories}</p>
            <p className="text-xs text-muted-foreground mt-1">distinct trade categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company name, category, or contact..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Vendor Grid */}
      {filteredVendors.length > 0 ? (
        <>
          {searchQuery && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                vendorInvitations={invitationsByVendor.get(vendor.id) || []}
                onInvite={(vendorId, email) => {
                  setInviteVendorId(vendorId)
                  setInviteEmail(email)
                  setInviteDialogOpen(true)
                }}
                onLinkContact={openLinkDialog}
              />
            ))}
          </div>
        </>
      ) : vendors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No vendors yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Vendors will appear here once they are added to the project or synced from JobTread.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No matching vendors</h3>
            <p className="text-sm text-muted-foreground">
              No vendors match &ldquo;{searchQuery}&rdquo;. Try a different search term.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Vendor Invitations
              <Badge variant="secondary" className="ml-auto">{invitations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((inv) => {
                const vendor = vendors.find(v => v.id === inv.vendor_id)
                const isExpired = new Date(inv.expires_at) < new Date()
                const isAccepted = !!inv.accepted_at

                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {vendor?.company_name || 'Unknown vendor'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAccepted ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Accepted</Badge>
                      ) : isExpired ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Expired</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Pending</Badge>
                      )}
                      {!isAccepted && !isExpired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => copyInviteLink(inv.token)}
                        >
                          {copiedToken === inv.token ? (
                            <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Copied</>
                          ) : (
                            <><Copy className="h-3 w-3" /> Link</>
                          )}
                        </Button>
                      )}
                      {!isAccepted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleRevoke(inv.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link Contact Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) setContactSearch('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Link Contact to {linkVendorName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center justify-between gap-2 ${
                      c.id === linkCurrentContactId ? 'bg-accent' : ''
                    }`}
                    disabled={linkLoading}
                    onClick={() => handleLinkContact(c.id)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.role, c.company].filter(Boolean).join(' — ') || c.email || 'No details'}
                      </p>
                    </div>
                    {c.id === linkCurrentContactId && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {contacts.length === 0 ? 'No contacts in project' : 'No contacts match search'}
                </div>
              )}
            </div>

            {linkCurrentContactId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-muted-foreground"
                disabled={linkLoading}
                onClick={() => handleLinkContact(null)}
              >
                {linkLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
                Remove linked contact
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Vendor to Portal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Send a portal invitation so this vendor can view their bids, documents, and project communications.
              The link expires in 7 days.
            </p>
            <div>
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="vendor@company.com"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail.includes('@') || inviteLoading}
                className="gap-2"
              >
                {inviteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
