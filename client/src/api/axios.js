// src/api/axios.js
// This is the most important frontend file
// Every API call in the app goes through this instance
// It automatically attaches JWT and handles token refresh

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' }
})

// ─────────────────────────────────────────────────────
// REQUEST INTERCEPTOR
// Runs before every API call
// Automatically attaches the access token to every request
// So you never have to manually add Authorization header
// ─────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Get access token from localStorage
    const token = localStorage.getItem('accessToken')

    if (token) {
      // Attach to every request automatically
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ─────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR
// Runs after every API response
// If server returns 401 (token expired), automatically:
//   1. Gets new access token using refresh token
//   2. Retries the original failed request
//   3. User never sees the error — it's seamless
//
// This is called "silent token refresh" — industry standard pattern
// ─────────────────────────────────────────────────────
let isRefreshing = false
// isRefreshing prevents multiple simultaneous refresh calls
// if 3 requests fail at once, only 1 refresh call is made

let failedQueue = []
// failedQueue stores requests that failed while refresh was happening
// After refresh succeeds, all queued requests are retried

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  // If response is successful, just return it
  (response) => response,

  // If response fails
  async (error) => {
    const originalRequest = error.config

    // ── Handle 401 (token expired) ──
    if (error.response?.status === 401 && !originalRequest._retry) {
      // _retry flag prevents infinite loop
      // If refresh also returns 401, we don't retry again

      if (isRefreshing) {
        // Another request is already refreshing — queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')

      if (!refreshToken) {
        // No refresh token — user must login again
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        // Call refresh endpoint
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          { refreshToken }
        )

        const { accessToken, refreshToken: newRefreshToken } = response.data.data

        // Save new tokens
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', newRefreshToken)

        // Update default header for future requests
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`

        // Process all queued requests with new token
        processQueue(null, accessToken)

        // Retry the original failed request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)

      } catch (refreshError) {
        // Refresh failed — force logout
        processQueue(refreshError, null)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api