import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { AUTH_PAGES } from '../constants/testIds';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Wholesale account</p>
      <h1 className="font-display mt-1 text-4xl text-[#121826]">Create Account</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input data-testid={AUTH_PAGES.registerNameInput} placeholder="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <Input data-testid={AUTH_PAGES.registerEmailInput} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <Input data-testid={AUTH_PAGES.registerBusinessNameInput} placeholder="Business name (optional)" value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} />
        <Input data-testid={AUTH_PAGES.registerPasswordInput} type="password" placeholder="Password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        {error && <p data-testid={AUTH_PAGES.registerError} className="text-sm text-[#EF4444]">{error}</p>}
        <Button data-testid={AUTH_PAGES.registerSubmitButton} type="submit" disabled={loading} className="w-full rounded-full bg-[#FF4500] py-5 text-white hover:bg-[#FF4500]/90">
          {loading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>
      <p className="mt-5 text-sm text-[#5E6A7D]">
        Already have an account? <Link to="/login" className="text-[#0B132B] underline">Sign in</Link>
      </p>
    </div>
  );
}
