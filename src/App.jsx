import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import Login from '@/components/auth/Login'
import Dashboard from '@/pages/Dashboard'
import AttributeBank from '@/pages/AttributeBank'
import IndustryManagement from '@/pages/IndustryManagement'
import UserManagement from '@/pages/UserManagement'
import Evaluations from '@/pages/Evaluations'
import AttributeManagement from '@/pages/AttributeManagement'
import CompanyManagement from '@/pages/CompanyManagement'
import Reports from '@/pages/Reports'
import UserDashboardPage from '@/pages/UserDashboardPage'
import UserEvaluationsPage from '@/pages/UserEvaluationsPage'
import NotFound from '@/components/common/NotFound'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/protected-route'
import UserRouteGuard from '@/components/guards/UserRouteGuard'
import AdminRouteGuard from '@/components/guards/AdminRouteGuard'
import AppSidebar from '@/components/layout/app-sidebar'
import { supabase } from '@/supabase'
import { Toaster } from 'sonner'
import { useState } from 'react'
import { Menu } from 'lucide-react'

function Layout() {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-background flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <AppSidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto relative">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden absolute top-6 left-4 z-10"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Routes>
            {/* Admin Routes */}
            <Route path="/dashboard" element={<AdminRouteGuard><Dashboard /></AdminRouteGuard>} />
            <Route path="/attribute-bank" element={<AdminRouteGuard><AttributeBank /></AdminRouteGuard>} />
            <Route path="/attribute-management" element={<AdminRouteGuard><AttributeManagement /></AdminRouteGuard>} />
            <Route path="/industry-management" element={<AdminRouteGuard><IndustryManagement /></AdminRouteGuard>} />
            <Route path="/user-management" element={<AdminRouteGuard><UserManagement /></AdminRouteGuard>} />
            <Route path="/company-management" element={<AdminRouteGuard><CompanyManagement /></AdminRouteGuard>} />
            <Route path="/reports" element={<AdminRouteGuard><Reports /></AdminRouteGuard>} />
            <Route path="/evaluations" element={<AdminRouteGuard><Evaluations /></AdminRouteGuard>} />
            
            {/* User Routes */}
            <Route path="/user" element={
              <UserRouteGuard>
                <UserDashboardPage />
              </UserRouteGuard>
            } />
            <Route path="/user/evaluations" element={
              <UserRouteGuard>
                <UserEvaluationsPage />
              </UserRouteGuard>
            } />
            <Route path="/user/reports" element={
              <UserRouteGuard>
                <Reports />
              </UserRouteGuard>
            } />
            
            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 Route - Must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App
