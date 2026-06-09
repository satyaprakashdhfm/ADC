'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin, register as apiRegister, AuthResponse } from '@/lib/api';

interface User { name: string; email: string; role: string; initials: string; }

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adc_token');
    const stored = localStorage.getItem('adc_user');
    if (token && stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const saveUser = (res: AuthResponse) => {
    localStorage.setItem('adc_token', res.token);
    const u: User = {
      name: res.name, email: res.email, role: res.role,
      initials: res.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(),
    };
    localStorage.setItem('adc_user', JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    saveUser(res);
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await apiRegister(name, email, phone, password);
    saveUser(res);
  };

  const logout = () => {
    localStorage.removeItem('adc_token');
    localStorage.removeItem('adc_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
