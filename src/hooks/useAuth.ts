import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { toast } from 'sonner';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setUserProfile(parsedUser);

        fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).then(res => {
          if (!res.ok) {
            handleLogout();
          }
        }).catch(() => {
          // Keep local state if just offline
        });
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setIsAuthReady(true);
  }, []);

  const handleSendOtp = async (email: string) => {
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

      toast.success('Secure code sent to your email');
      return true;
    } catch (error: any) {
      console.error('OTP Send error:', error);
      toast.error(error.message || 'Failed to send secure code');
      return false;
    }
  };

  const handleVerifyOtp = async (email: string, code: string) => {
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setUserProfile(data.user);
      toast.success('Successfully logged in');
      return true;
    } catch (error: any) {
      console.error('OTP Verify error:', error);
      toast.error(error.message || 'Invalid code');
      return false;
    }
  };

  const handlePasswordLogin = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setUserProfile(data.user);
      toast.success('Successfully logged in');
      return true;
    } catch (error: any) {
      console.error('Password login error:', error);
      toast.error(error.message || 'Invalid password');
      return false;
    }
  };

  const handleSetPassword = async (password: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to set password');

      toast.success('Password updated successfully');
      return true;
    } catch (error: any) {
      console.error('Set password error:', error);
      toast.error(error.message || 'Failed to set password');
      return false;
    }
  };

  const checkHasPassword = async (email: string) => {
    try {
      const response = await fetch(`/api/auth/check-auth?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      return data.hasPassword as boolean;
    } catch {
      return false;
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setUserProfile(null);
    toast.success('Logged out');
  };

  return {
    user, userProfile, isAuthReady,
    handleSendOtp, handleVerifyOtp,
    handlePasswordLogin, handleSetPassword, checkHasPassword,
    handleLogout
  };
}
