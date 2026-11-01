import { redirect } from 'next/navigation'

/** The executive dashboard lives at /dashboard; the root URL sends people there. */
export default function HomePage() {
  redirect('/dashboard')
}
