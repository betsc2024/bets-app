import { useLocation, Link, useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Database, 
  Building2, 
  Users2, 
  ClipboardList, 
  LogOut,
  Settings,
  BarChart3,
  Building,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react"
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/supabase'
import { useState, useEffect } from 'react'
import Logo from '@/assets/BEtS-Logo.svg'

export default function AppSidebar({ isOpen, onToggle }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState(null)
  
  useEffect(() => {
    fetchUserRole();
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserRole(data.role);
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const adminSidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Database, label: "Attribute Bank", href: "/attribute-bank" },
    { icon: Building, label: "Company Management", href: "/company-management" },
    { icon: ClipboardList, label: "Evaluations", href: "/evaluations" },
    { icon: BarChart3, label: "Reports", href: "/reports" },
    { icon: Settings, label: "Attribute Management", href: "/attribute-management" },
    { icon: Building2, label: "Industry Management", href: "/industry-management" },
    { icon: Users2, label: "User Management", href: "/user-management" },
  ];

  const userSidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/user" },
    { icon: ClipboardList, label: "My Evaluations", href: "/user/evaluations" },
    { icon: BarChart3, label: "My Reports", href: "/user/reports" },
  ];

  const sidebarItems = userRole === 'user' ? userSidebarItems : adminSidebarItems;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        onToggle(false)
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Check initial size
    
    return () => window.removeEventListener('resize', handleResize)
  }, [onToggle])

  const handleSignOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`
      fixed lg:static inset-y-0 left-0 z-20
      ${isOpen ? 'w-64' : 'w-0 lg:w-16'} 
      bg-background border-r border-border flex flex-col
      transition-all duration-300
      ${!isOpen && 'translate-x-[-100%] lg:translate-x-0'}
    `}>
      <div className={`p-4 flex-1 ${!isOpen && 'lg:block hidden'}`}>
        <div className="mb-8 relative">
          <div className="flex justify-center items-center">
            <img 
              src={Logo} 
              alt="BETs Logo" 
              className={`${isOpen ? 'h-10 w-auto' : 'h-8 w-8'} transition-all duration-300`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle(!isOpen)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border bg-background shadow-md"
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>

        {/* User Info */}
        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {userRole || 'Loading...'}
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1.5">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Button
                key={item.label}
                variant={isActive ? "default" : "ghost"}
                className={`w-full ${isOpen ? 'justify-start px-4' : 'justify-center px-2'} gap-3 text-muted-foreground ${
                  isActive 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" 
                    : "hover:bg-primary/10 hover:text-primary"
                }`}
                title={isOpen ? undefined : item.label}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="h-4 w-4" />
                  {isOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>

      <div className={`p-4 border-t border-border ${!isOpen && 'lg:block hidden'} ${isOpen ? '' : 'flex justify-center'}`}>
        <Button 
          variant="default"
          className={`${isOpen ? 'w-full' : 'w-10 px-0'} bg-primary hover:bg-primary/90 text-primary-foreground font-semibold`}
          onClick={handleSignOut}
          disabled={loading}
          title={isOpen ? undefined : 'Sign Out'}
        >
          <LogOut className="h-4 w-4" />
          {isOpen && <span className="ml-2">{loading ? 'Signing out...' : 'Sign Out'}</span>}
        </Button>
      </div>
    </div>
  )
}
