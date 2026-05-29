import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const loginJustCompleted = useRef(false);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check if login just completed (user already set)
      if (loginJustCompleted.current) {
        loginJustCompleted.current = false;
        setLoading(false);
        return;
      }
      
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`);
          setUser(response.data);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const data = response.data || {};

      // 2FA challenge — caller must collect OTP and call verify2FA
      if (data.requires_2fa) {
        return {
          success: true,
          requires_2fa: true,
          challenge_token: data.challenge_token,
          email: data.email
        };
      }

      const { access_token, user: userData } = data;
      localStorage.setItem('token', access_token);
      loginJustCompleted.current = true;
      setToken(access_token);
      setUser(userData);

      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      };
    }
  };

  const verify2FA = async (challenge_token, code) => {
    try {
      const response = await axios.post(`${API}/auth/login/verify-2fa`, { challenge_token, code });
      const { access_token, user: userData, used_backup_code, remaining_backup_codes } = response.data;
      localStorage.setItem('token', access_token);
      loginJustCompleted.current = true;
      setToken(access_token);
      setUser(userData);
      return { success: true, user: userData, used_backup_code, remaining_backup_codes };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || '2FA verification failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    // Force a full redirect to clear any stale state across protected routes
    window.location.href = '/login';
  };

  const value = {
    user,
    token,
    login,
    verify2FA,
    logout,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'super_admin',
    isOutletAdmin: user?.role === 'outlet_admin',
    isOrderManager: user?.role === 'order_manager',
    isKitchen: user?.role === 'kitchen',
    isDelivery: user?.role === 'delivery',
    isAccounts: user?.role === 'accounts',
    refreshUser: async () => {
      try {
        const r = await axios.get(`${API}/auth/me`);
        setUser(r.data);
        return r.data;
      } catch (e) {
        return null;
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
