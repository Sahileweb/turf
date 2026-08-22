// src/context/AuthContext.jsx
// Global auth state — user info, login, logout
// Any component can access this via useAuth() hook

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // loading = true while we check if user is already logged in
  // This prevents the login page flashing before we know they're logged in

  // ── On app load: check if tokens exist and fetch user ──
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken')

      if (!token) {
        setLoading(false)
        return
      }

      try {
        // Fetch current user data using stored token
        const response = await api.get('/auth/me')
        setUser(response.data.data.user)
      } catch (error) {
        // Token invalid or expired — clear everything
        localStorage.clear()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // ── Login ──
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const { user, accessToken, refreshToken } = response.data.data

    // Save tokens to localStorage
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)

    // Update axios default header
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`

    setUser(user)
    return user
  }

  // ── Register ──
  const register = async (name, email, phone, password, role) => {
    const response = await api.post('/auth/register', {
      name, email, phone, password, role
    })
    const { user, accessToken, refreshToken } = response.data.data

    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`

    setUser(user)
    return user
  }

  // ── Logout ──
  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Even if logout API fails, clear local state
    }
    localStorage.clear()
    delete api.defaults.headers.common.Authorization
    setUser(null)
  }

  const isOwner = user?.role === 'OWNER'
  const isCustomer = user?.role === 'CUSTOMER'

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      isOwner,
      isCustomer,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook — makes it easy to use auth anywhere
// Usage: const { user, login, logout } = useAuth()
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}