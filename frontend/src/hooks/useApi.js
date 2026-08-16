import { useState, useCallback } from 'react'

export function useApi() {
  const token = localStorage.getItem('mk_token')

  const request = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    return res.json()
  }, [token])

  const get = (url) => request(url)
  const post = (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) })
  const put = (url, body) => request(url, { method: 'PUT', body: JSON.stringify(body) })
  const del = (url) => request(url, { method: 'DELETE' })

  return { get, post, put, del }
}

export function useFetch(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const token = localStorage.getItem('mk_token')

  const fetch_ = useCallback(async (overrideUrl) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(overrideUrl || url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.message)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url, token])

  return { data, loading, error, refetch: fetch_ }
}
