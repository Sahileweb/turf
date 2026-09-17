import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import FacilityDetail from './pages/FacilityDetail'
import BookingConfirm from './pages/BookingConfirm'
import MyBookings from './pages/MyBookings'
import Dashboard from './pages/Dashboard'
import AddFacility from './pages/AddFacility'
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,  
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

            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          

          <Route
              path="/booking/confirm"
              element={
                <ProtectedRoute requiredRole="CUSTOMER">
                  <BookingConfirm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute requiredRole="CUSTOMER">
                  <MyBookings />
                </ProtectedRoute>
              }
            />
               <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="OWNER">
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/facility/add" element={
              <ProtectedRoute requiredRole="OWNER">
                <AddFacility />
                </ProtectedRoute>
              } />
            <Route path="/facility/:id" element={<FacilityDetail />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App