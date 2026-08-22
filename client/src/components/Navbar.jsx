// src/components/Navbar.jsx

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, User, MapPin } from 'lucide-react'

const Navbar = () => {
  const { user, logout, isAuthenticated, isOwner } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary-600 text-white p-1.5 rounded-lg">
              <MapPin size={20} />
            </div>
            <span className="text-xl font-bold text-gray-900">Turfly</span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {isOwner && (
                  <Link
                    to="/dashboard"
                    className="text-gray-600 hover:text-primary-600 font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                )}

                {!isOwner && (
                  <Link
                    to="/my-bookings"
                    className="text-gray-600 hover:text-primary-600 font-medium transition-colors"
                  >
                    My Bookings
                  </Link>
                )}

                {/* User info + logout */}
                <div className="flex items-center gap-3 ml-2">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full">
                    <User size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{user?.name}</span>
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                      {user?.role}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-primary-600 font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar