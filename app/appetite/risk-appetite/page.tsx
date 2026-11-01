import { redirect } from 'next/navigation'

/** Old duplicate of the risk appetite page; the real one lives at /risk-appetite. */
export default function Page() {
  redirect('/risk-appetite')
}
