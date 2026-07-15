import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { AUTH_PAGES } from '../constants/testIds';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Welcome back</p>
      <h1 className="font-display mt-1 text-4xl text-[#121826]">Sign In</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input data-testid={AUTH_PAGES.loginEmailInput} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input data-testid={AUTH_PAGES.loginPasswordInput} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p data-testid={AUTH_PAGES.loginError} className="text-sm text-[#EF4444]">{error}</p>}
        <Button data-testid={AUTH_PAGES.loginSubmitButton} type="submit" disabled={loading} className="w-full rounded-full bg-[#0B132B] py-5 text-white hover:bg-[#0B132B]/90">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
      <p className="mt-5 text-sm text-[#5E6A7D]">
        New wholesale buyer? <Link to="/register" className="text-[#0B132B] underline">Create an account</Link>
      </p>
    </div>
  );
}
