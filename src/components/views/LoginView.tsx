import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Key } from 'lucide-react';

interface LoginViewProps {
  loginEmail: string;
  setLoginEmail: (val: string) => void;
  loginOtp: string;
  setLoginOtp: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  otpSent: boolean;
  setOtpSent: (val: boolean) => void;
  isLoading: boolean;
  onSendOtp: (e: React.FormEvent) => void;
  onVerifyOtp: (e: React.FormEvent) => void;
  onPasswordLogin: (e: React.FormEvent) => void;
  checkHasPassword: (email: string) => Promise<boolean>;
}

export function LoginView({
  loginEmail, setLoginEmail,
  loginOtp, setLoginOtp,
  loginPassword, setLoginPassword,
  otpSent, setOtpSent,
  isLoading,
  onSendOtp,
  onVerifyOtp,
  onPasswordLogin,
  checkHasPassword
}: LoginViewProps) {
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;

    // Check if user has a password set
    const hasPassword = await checkHasPassword(loginEmail);
    if (hasPassword) {
      setShowPassword(true);
    } else {
      onSendOtp(e);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-sm text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col items-center gap-3"
        >
          <img src="/brand-mark.svg" alt="Service Operations Tracker" className="h-28 w-28 drop-shadow-lg" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Operations Tracker</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Order Management System</p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!otpSent && !showPassword ? (
            <motion.form
              key="email-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleEmailSubmit}
              className="space-y-4 text-left"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-600 ml-1">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    className="pl-10 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-100"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-14 text-base shadow-lg shadow-indigo-500/20 transition-all font-semibold"
              >
                {isLoading ? 'Checking...' : 'Continue'}
              </Button>
            </motion.form>
          ) : showPassword ? (
            <motion.form
              key="password-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={onPasswordLogin}
              className="space-y-4 text-left"
            >
              <div className="space-y-2">
                <Label htmlFor="password" title={loginEmail} className="text-slate-600 flex justify-between ml-1">
                  <span>Enter Password</span>
                  <button type="button" onClick={() => { setShowPassword(false); onSendOtp(new Event('submit') as any); }} className="text-indigo-500 text-[10px] uppercase font-bold tracking-wider hover:underline">Use OTP Instead</button>
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    required
                    placeholder="Your password"
                    className="pl-10 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-100"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-slate-400 font-medium">{loginEmail}</span>
                  <button type="button" onClick={() => setShowPassword(false)} className="text-[10px] text-slate-300 hover:text-slate-500">Change Account</button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-14 text-base shadow-lg shadow-indigo-500/20 transition-all font-semibold"
              >
                {isLoading ? 'Logging in...' : 'Sign In'}
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="otp-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={onVerifyOtp}
              className="space-y-4 text-left"
            >
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-600 flex justify-between ml-1">
                  <span>Secure Code</span>
                  <button type="button" onClick={() => setOtpSent(false)} className="text-indigo-500 text-xs hover:underline">Change Email</button>
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    id="otp"
                    type="text"
                    required
                    placeholder="Enter 6-digit code"
                    className="pl-10 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-100 text-center tracking-widest text-lg font-bold"
                    value={loginOtp}
                    maxLength={6}
                    onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center py-2">We sent a code to {loginEmail}</p>
              </div>
              <Button
                type="submit"
                disabled={isLoading || loginOtp.length < 6}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl h-14 text-base shadow-lg shadow-indigo-500/20 transition-all font-semibold"
              >
                {isLoading ? 'Verifying...' : 'Verify and Login'}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-8">Enterprise Internal System</p>
      </div>
    </div>
  );
}
