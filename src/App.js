import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './pages/AdminAuth'
import { LoadingProvider } from './pages/LoadingContext'
import B2BOrders from './pages/B2BOrders'
import HomePage from './pages/HomePage'
import Transaction from './pages/Transaction'
import Stocks from './pages/Stocks'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import LoginAdmin from './pages/LoginAdmin'
import ImportStock from './pages/ImportStock'
import POS from './pages/POS'
import AdminHomepageImages from './pages/AdminHomepageImages'
import OrderIssues from './pages/OrderIssues'
import ReturnReview from './pages/ReturnReview'

function RequireAuth({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginAdmin />} />
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/transactions" element={<RequireAuth><Transaction /></RequireAuth>} />
            <Route path="/stocks" element={<RequireAuth><Stocks /></RequireAuth>} />
            <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
            <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
            <Route path="/pos" element={<RequireAuth><POS /></RequireAuth>} />
            <Route path="/import" element={<RequireAuth><ImportStock /></RequireAuth>} />
            <Route path="/homepage-images" element={<RequireAuth><AdminHomepageImages /></RequireAuth>} />
            <Route path="/order-issues" element={<RequireAuth><OrderIssues /></RequireAuth>} />
            <Route path="/returns/:id" element={<RequireAuth><ReturnReview /></RequireAuth>} />
            <Route path="/b2b-orders" element={<RequireAuth><B2BOrders /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </LoadingProvider>
    </AuthProvider>
  )
}
