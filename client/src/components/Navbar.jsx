import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, User } from 'lucide-react'

const Navbar = () => {
  const { user, logout, isAuthenticated, isOwner } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav style={{
      background: 'rgba(7,26,15,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(34,197,94,0.12)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18
          }}>⚽</div>
          <span className="font-display text-2xl text-grass-bright tracking-widest">TURFLY</span>
          <span style={{ width: 6, height: 6, background: '#F59E0B', borderRadius: '50%' }} />
        </Link>

        {/* Links */}
        <div className="flex items-center gap-6">
          {isAuthenticated ? (
            <>
              {isOwner ? (
                <Link to="/dashboard" className="text-sm font-medium text-green-300 hover:text-white transition-colors">
                  Dashboard
                </Link>
              ) : (
                <Link to="/my-bookings" className="text-sm font-medium text-green-300 hover:text-white transition-colors">
                  My Bookings
                </Link>
              )}

              {/* User pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <User size={14} className="text-green-400" />
                <span className="text-sm font-medium text-green-100">{user?.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.2)', color: '#22C55E' }}>
                  {user?.role}
                </span>
              </div>

              <button onClick={handleLogout} className="text-green-600 hover:text-red-400 transition-colors">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-green-300 hover:text-white transition-colors">
                Login
              </Link>
              <Link to="/register" className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar