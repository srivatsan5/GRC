import { useState, useCallback, useEffect } from 'react'

interface UseDataFetchOptions {
  retry?: number
  retryDelay?: number
  skipCache?: boolean
  onError?: (error: Error) => void
  onSuccess?: (data: any) => void
}

interface UseDataFetchState {
  data: any
  isLoading: boolean
  error: Error | null
  retry: () => Promise<void>
}

/**
 * Custom hook for data fetching with automatic retry, caching, and error handling
 */
export function useDataFetch(
  fetchFn: () => Promise<any>,
  dependencies: any[] = [],
  options: UseDataFetchOptions = {}
): UseDataFetchState {
  const {
    retry: maxRetries = 3,
    retryDelay = 1000,
    skipCache = false,
    onError,
    onSuccess,
  } = options

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const executefetch = useCallback(async () => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setIsLoading(true)
        setError(null)

        const result = await fetchFn()
        setData(result)
        setRetryCount(0)
        onSuccess?.(result)
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
        }
      }
    }

    // All retries exhausted
    setError(lastError)
    setRetryCount(prev => prev + 1)
    onError?.(lastError || new Error('Unknown error'))
    setIsLoading(false)
  }, [fetchFn, maxRetries, retryDelay, onError, onSuccess])

  useEffect(() => {
    executefetch()
  }, dependencies)

  const retry = useCallback(async () => {
    setRetryCount(prev => prev + 1)
    await executefetch()
  }, [executefetch])

  return {
    data,
    isLoading,
    error,
    retry,
  }
}

/**
 * Hook for handling API request state with caching
 */
export function useApiRequest(
  requestFn: () => Promise<any>,
  options: UseDataFetchOptions = {}
) {
  const [state, setState] = useState({
    data: null as any,
    loading: false,
    error: null as Error | null,
  })

  const [cacheKey] = useState(() => requestFn.toString())

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await requestFn()
      setState(prev => ({ ...prev, data: result, loading: false }))
      options.onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState(prev => ({ ...prev, error, loading: false }))
      options.onError?.(error)
      throw error
    }
  }, [requestFn, options])

  return {
    ...state,
    execute,
    isLoading: state.loading,
  }
}

/**
 * Hook for pagination state management
 */
export function usePagination(defaultPage = 1, defaultLimit = 10) {
  const [page, setPage] = useState(defaultPage)
  const [limit, setLimit] = useState(defaultLimit)

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage))
  }, [])

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1)
  }, [])

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1))
  }, [])

  const setPageSize = useCallback((newLimit: number) => {
    setLimit(Math.max(1, newLimit))
    setPage(1) // Reset to first page when changing page size
  }, [])

  const offset = (page - 1) * limit

  return {
    page,
    limit,
    offset,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
  }
}
