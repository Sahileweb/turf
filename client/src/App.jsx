// src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import FacilityDetail from './pages/FacilityDetail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,  // Cache data for 5 minutes
    }
  }
})

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>

            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/facility/:id" element={<FacilityDetail />} />

            {/* Protected customer routes (Day 8) */}
            {/* <Route path="/my-bookings" element={
              <ProtectedRoute requiredRole="CUSTOMER">
                <MyBookings />
              </ProtectedRoute>
            } /> */}

            {/* Protected owner routes (Day 9) */}
            {/* <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="OWNER">
                <Dashboard />
              </ProtectedRoute>
            } /> */}

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App