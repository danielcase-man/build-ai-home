import PaymentsClient from './PaymentsClient'

export const metadata = {
  title: 'Payments | UBuildIt Manager',
  description: 'Track transactions, contracts, invoices, and vendor balances',
}

export default function PaymentsPage() {
  return <PaymentsClient />
}
