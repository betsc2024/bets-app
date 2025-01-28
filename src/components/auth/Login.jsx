import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from '../../supabase'
import { themeConfig } from '../../config/theme'
import BEtsLogo from '../../assets/BEtS-Logo.svg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    try {
      // First attempt the login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (loginError) {
        console.error('Login error:', loginError)
        if (loginError.message.includes('Invalid login credentials')) {
          setError('Incorrect email or password')
        } else if (loginError.message.includes('Email not confirmed')) {
          setError('Please verify your email before logging in')
        } else {
          setError('Unable to sign in at this time. Please try again.')
        }
        return
      }

      if (!data?.user?.id) {
        setError('No user data received')
        return
      }

      // Get user data after successful login
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, company_id, is_super_admin')
        .eq('id', data.user.id)
        .single()

      if (userError) {
        console.error('User data error:', userError)
        setError('Error fetching user data')
        return
      }

      // Update user metadata with role information
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          role: userData.is_super_admin ? 'super_admin' : userData.role,
          company_id: userData.company_id
        }
      })

      if (updateError) {
        console.error('Error updating user metadata:', updateError)
      }

      // Determine redirect path based on user role
      let redirectPath;
      if (userData.is_super_admin) {
        redirectPath = '/dashboard';
      } else if (userData.role === 'company_admin') {
        redirectPath = '/dashboard';
      } else {
        redirectPath = '/user';
      }

      // Use the determined path or the saved location
      const from = location.state?.from?.pathname || redirectPath;
      navigate(from, { replace: true });
      
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-[400px] px-4">
        <Card className="shadow-lg border-primary/10">
          <CardHeader className="space-y-1">
            <div className="mx-auto w-24 h-24 mb-6">
              <img src={BEtsLogo} alt="BETs Logo" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl text-center text-primary font-bold">Welcome Back</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`${error ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-primary/30'}`}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${error ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-primary/30'}`}
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="text-sm text-destructive font-medium">
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-semibold"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
