// src/components/PasswordConfirmModal.jsx

import { useState } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const PasswordConfirmModal = ({ isOpen, onClose, onConfirm, title, description }) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    setLoading(true)
    setError('')

    try {
      // ── Use dedicated verify-password endpoint ──
      // This checks password WITHOUT regenerating tokens
      // Safe to call while logged in
      await api.post('/auth/verify-password', { password })

      // Password correct — proceed
      setPassword('')
      onConfirm()
      onClose()

    } catch (err) {
      // 401 = wrong password, 500 = server error
      const msg = err.response?.data?.message || 'Incorrect password. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose()
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{
        background: '#0A2D18',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 20,
        padding: '32px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.15s ease'
      }}>

        {/* Warning icon */}
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 20
        }}>
          ⚠️
        </div>

        {/* Title */}
        <div style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: 28, letterSpacing: 1,
          color: 'white', marginBottom: 10
        }}>
          {title || 'CONFIRM DELETION'}
        </div>

        {/* Description */}
        <p style={{
          fontSize: 13, color: '#86EFAC',
          marginBottom: 8, lineHeight: 1.6
        }}>
          {description}
        </p>

        <p style={{
          fontSize: 12, color: '#F87171',
          marginBottom: 24,
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)',
          borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.15)'
        }}>
          ⚠️ This permanently deletes all courts, slots, and booking history. Cannot be undone.
        </p>

        {/* Account info */}
        <div style={{
          fontSize: 12, color: '#4B7A5E',
          marginBottom: 12
        }}>
          Confirming as: <span style={{ color: '#86EFAC' }}>{user?.email}</span>
        </div>

        {/* Password input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 12, color: '#86EFAC',
            display: 'block', marginBottom: 8, fontWeight: 600
          }}>
            Enter your account password to confirm:
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && !loading && handleConfirm()}
            placeholder="Your Turfly account password"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: error
                ? '1px solid rgba(239,68,68,0.6)'
                : '1px solid rgba(255,255,255,0.12)',
              color: 'white', fontSize: 14, outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />

          {/* Error message */}
          {error && (
            <div style={{
              fontSize: 12, color: '#F87171',
              marginTop: 8,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              ✕ {error}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              flex: 1, padding: '13px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#86EFAC', fontSize: 14, fontWeight: 500,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={loading || !password.trim()}
            style={{
              flex: 1, padding: '13px', borderRadius: 10,
              cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
              background: loading || !password.trim()
                ? 'rgba(239,68,68,0.2)'
                : 'rgba(239,68,68,0.8)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'white', fontSize: 14, fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              if (!loading && password.trim()) e.currentTarget.style.background = '#DC2626'
            }}
            onMouseLeave={e => {
              if (!loading && password.trim()) e.currentTarget.style.background = 'rgba(239,68,68,0.8)'
            }}
          >
            {loading ? 'Verifying...' : '🗑️ Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PasswordConfirmModal