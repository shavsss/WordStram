import React, { useState } from 'react';
import './Login.css';
import type { User } from 'firebase/auth';

interface LoginProps {
  onLogin: () => Promise<User | null>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLogin, setIsEmailLogin] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      // Since we're not using email login in this version, just handle it with Google
      await onLogin();
    } catch (err) {
      setError((err as Error).message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      await onLogin();
    } catch (err) {
      setError((err as Error).message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLoginMethod = () => {
    setIsEmailLogin(!isEmailLogin);
    setError(null);
  };

  return (
    <div className="login-container">
      <h2>WordStram</h2>
      <p className="login-description">Sign in to save words and track your progress</p>
      
      {error && <div className="login-error">{error}</div>}
      
      {isEmailLogin ? (
        <>
          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              className="login-button email-login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in with Email'}
            </button>
          </form>
          <button 
            className="toggle-login-method"
            onClick={toggleLoginMethod}
            disabled={isLoading}
          >
            Sign in with Google instead
          </button>
        </>
      ) : (
        <>
          <button 
            className="login-button google-login-button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          <button 
            className="toggle-login-method"
            onClick={toggleLoginMethod}
            disabled={isLoading}
          >
            Sign in with Email instead
          </button>
        </>
      )}
    </div>
  );
};

export default Login; 