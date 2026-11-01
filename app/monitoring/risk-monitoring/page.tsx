import { redirect } from 'next/navigation'

// This page duplicated /monitoring (the action-plan monitoring view over per_trn_risk_monitoring).
// Keep the URL working for existing links and bookmarks.
export default function Page() {
  redirect('/monitoring')
}
