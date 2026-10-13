import { useEffect, useState } from 'react'

// A reusable hook for loading data.
// Usage: const { data, loading, error, retry } = useFetch(() => getRaces(year), [year])
//
// - loader: a function that returns a Promise (one of the functions from api/f1.js)
// - deps:   when any value in this array changes, the data is loaded again
export default function useFetch(loader, deps) {
  const [attempt, setAttempt] = useState(0) // bumping this re-runs the request ("Try again")

  // A key that identifies the current request, e.g. '[2025,0]'.
  const requestKey = JSON.stringify([...deps, attempt])

  // We remember which request the stored data/error belongs to.
  const [result, setResult] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    // If the user switches page or season before the request finishes, this flag
    // stops the old (stale) response from overwriting the new one.
    let ignore = false

    loader()
      .then((data) => {
        if (!ignore) setResult({ key: requestKey, data, error: null })
      })
      .catch((error) => {
        if (!ignore) setResult({ key: requestKey, data: null, error })
      })

    // Cleanup function: React runs this before the effect runs again or the component unmounts.
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  // "Loading" isn't stored separately: if the result we have belongs to a different
  // request than the current one, the current one must still be loading.
  // This way old data can never be shown for a new request, not even for one render.
  const loading = result.key !== requestKey

  return {
    data: loading ? null : result.data,
    error: loading ? null : result.error,
    loading,
    retry: () => setAttempt((n) => n + 1),
  }
}
