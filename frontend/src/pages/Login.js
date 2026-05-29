import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, KeyRound } from 'lucide-react';

const Login = () => {
  const [step, setStep] = useState('credentials'); // 'credentials' | '2fa'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();

  const redirectByRole = (user) => {
    if (user.role === 'kitchen') navigate('/kitchen');
    else if (user.role === 'delivery') navigate('/delivery');
    else navigate('/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      if (result.requires_2fa) {
        setChallengeToken(result.challenge_token);
        setPendingEmail(result.email || email);
        setStep('2fa');
        setLoading(false);
        return;
      }
      redirectByRole(result.user);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verify2FA(challengeToken, otp);
    if (result.success) {
      if (result.used_backup_code) {
        // Inform but proceed
        // eslint-disable-next-line no-alert
        alert(`Backup code accepted. ${result.remaining_backup_codes} backup code(s) remaining.`);
      }
      redirectByRole(result.user);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtp('');
    setChallengeToken('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-white">
      <Card className="w-full max-w-md shadow-xl" data-testid="login-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/us-bakers-logo.jpg"
              alt="US Bakers"
              className="h-24 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold" style={{ color: '#e92587' }}>
            US Bakers
          </CardTitle>
          <CardDescription className="text-lg">
            {step === 'credentials' ? 'Bakery Management System' : 'Two-Factor Authentication'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'credentials' && (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-credentials-form">
              {error && (
                <Alert variant="destructive" data-testid="login-error-alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@usbakers.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: '#e92587' }}
                disabled={loading}
                data-testid="login-submit-button"
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          )}

          {step === '2fa' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4" data-testid="login-2fa-form">
              <div className="flex items-center gap-2 rounded-md border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-700">
                <ShieldCheck className="h-4 w-4" />
                <span>Verifying <strong>{pendingEmail}</strong></span>
              </div>

              {error && (
                <Alert variant="destructive" data-testid="login-2fa-error-alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Enter 6-digit code from your Authenticator
                </Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder="123 456  or  BACKUP-CODE"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={12}
                  className="tracking-widest text-center text-lg"
                  data-testid="login-2fa-code-input"
                />
                <p className="text-xs text-gray-500">
                  Lost access? Enter one of your 8-character backup codes instead.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: '#e92587' }}
                disabled={loading || otp.length < 6}
                data-testid="login-2fa-verify-button"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToCredentials}
                disabled={loading}
                data-testid="login-2fa-back-button"
              >
                Back to login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
