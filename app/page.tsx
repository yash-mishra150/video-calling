"use client";

import { FC, useEffect, useState } from 'react';
import AuthPage from '@/components/AuthPage';
import AppDashboard from '@/components/AppDashboard';

const Home: FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    if (token && storedUsername) {
      setUsername(storedUsername);
      setIsAuthenticated(true);
    }

    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (token: string, user: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', user);
    setUsername(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setUsername('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-blue-600 to-purple-700">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <AppDashboard username={username} onLogout={handleLogout} />
  ) : (
    <AuthPage onLoginSuccess={handleLoginSuccess} />
  );
};

export default Home;
