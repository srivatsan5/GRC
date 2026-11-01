'use client'

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/apiClient'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // A failed load is shown to the user instead of silently rendering "no data".
        queryCache: new QueryCache({
          onError: (error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status
            if (status === 401) return // handled by the auth provider (back to sign-in)
            const message = apiErrorMessage(error, 'Could not load data')
            toast.error('Data could not be loaded', { id: `query-error:${message}`, description: message })
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error: unknown) => {
              const status = (error as { response?: { status?: number } })?.response?.status
              if (status && status >= 400 && status < 500) return false // don't retry auth/permission/validation errors
              return failureCount < 1
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
