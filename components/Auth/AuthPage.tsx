import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
  };

  return mode === 'login' ? (
    <LoginForm onToggleMode={toggleMode} />
  ) : (
    <SignUpForm onToggleMode={toggleMode} />
  );
};
