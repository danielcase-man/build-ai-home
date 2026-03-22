'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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

interface VendorsClientProps {
  vendors: VendorWithContact[]
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

function VendorCard({ vendor }: { vendor: VendorWithContact }) {
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
            {/* Linked contact indicator */}
            {hasLinkedContact && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mb-1">
                <LinkIcon className="h-3 w-3" />
                Linked Contact
              </div>
            )}

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
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <UserX className="h-4 w-4 shrink-0" />
            <span>No contact linked</span>
          </div>
        )}

        {vendor.notes && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t line-clamp-2">
            {vendor.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function VendorsClient({ vendors, projectId }: VendorsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')

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
              <VendorCard key={vendor.id} vendor={vendor} />
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
    </div>
  )
}
