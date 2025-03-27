import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged, 
  User
} from 'firebase/auth';

import { initializeFirebase } from '../../firebase/firebase-config';

// Initialize Firebase
initializeFirebase();

/**
 * Interface for the AuthContainer return value
 */
interface AuthContainer {
  showLoginView: () => void;
  showRegisterView: () => void;
  refresh: () => void;
  onAuthStateChange: (callback: (user: User | null) => void) => void;
}

/**
 * Creates and manages the authentication container
 * 
 * @param container - The HTML element to render the auth container in
 * @returns The auth container interface
 */
export function createAuthContainer(container: HTMLElement): AuthContainer {
  // Current user state
  let currentUser: User | null = null;
  let authStateCallback: ((user: User | null) => void) | null = null;
  
  // Register auth state change listener
  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    // Call the provided callback if set
    if (authStateCallback) {
      authStateCallback(user);
    }
    
    // Update the UI based on auth state
    renderAuthUI();
  });

  /**
   * Register callback for auth state changes
   * 
   * @param callback - The callback to call when auth state changes
   */
  function onAuthStateChange(callback: (user: User | null) => void): void {
    authStateCallback = callback;
    
    // Call immediately with current state
    if (callback) {
      callback(currentUser);
    }
  }

  /**
   * Renders the login view
   */
  function showLoginView(): void {
    container.innerHTML = `
      <div class="login-container">
        <h3 class="login-title">Sign in to WordStream2</h3>
        <input type="email" class="login-input" id="login-email" placeholder="Email" />
        <input type="password" class="login-input" id="login-password" placeholder="Password" />
        <button class="login-button" id="login-button">Sign In</button>
        <div class="separator"><span>OR</span></div>
        <button class="google-button" id="google-login-button">
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>
        <div class="register-link">
          Don't have an account? <a href="#" id="show-register-link">Sign up</a>
        </div>
        <div class="error-message" id="login-error"></div>
      </div>
    `;

    // Add event listeners
    document.getElementById('login-button')?.addEventListener('click', handleLogin);
    document.getElementById('google-login-button')?.addEventListener('click', handleGoogleLogin);
    document.getElementById('show-register-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      showRegisterView();
    });
  }

  /**
   * Renders the registration view
   */
  function showRegisterView(): void {
    container.innerHTML = `
      <div class="register-container">
        <h3 class="register-title">Create Account</h3>
        <input type="email" class="register-input" id="register-email" placeholder="Email" />
        <input type="password" class="register-input" id="register-password" placeholder="Password" />
        <input type="password" class="register-input" id="register-confirm-password" placeholder="Confirm Password" />
        <button class="register-button" id="register-button">Sign Up</button>
        <div class="separator"><span>OR</span></div>
        <button class="google-button" id="google-register-button">
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign up with Google
        </button>
        <div class="login-link">
          Already have an account? <a href="#" id="show-login-link">Sign in</a>
        </div>
        <div class="error-message" id="register-error"></div>
      </div>
    `;

    // Add event listeners
    document.getElementById('register-button')?.addEventListener('click', handleRegister);
    document.getElementById('google-register-button')?.addEventListener('click', handleGoogleLogin);
    document.getElementById('show-login-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginView();
    });
  }

  /**
   * Renders the user profile when logged in
   */
  function showUserProfile(): void {
    if (!currentUser) return;
    
    const displayName = currentUser.displayName || currentUser.email || 'User';
    const email = currentUser.email || '';
    const initials = displayName.charAt(0).toUpperCase();
    
    container.innerHTML = `
      <div class="profile-container">
        <div class="user-info">
          <div class="user-avatar">${initials}</div>
          <div class="user-details">
            <div class="user-name">${displayName}</div>
            <div class="user-email">${email}</div>
          </div>
        </div>
        <button class="logout-button" id="logout-button">Sign Out</button>
      </div>
    `;

    // Add event listener for logout
    document.getElementById('logout-button')?.addEventListener('click', handleLogout);
  }

  /**
   * Renders the auth UI based on authentication state
   */
  function renderAuthUI(): void {
    if (currentUser) {
      showUserProfile();
    } else {
      showLoginView();
    }
  }

  /**
   * Handles login form submission
   */
  async function handleLogin(): Promise<void> {
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    const errorElement = document.getElementById('login-error');
    
    if (!emailInput || !passwordInput || !errorElement) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      errorElement.textContent = 'Please enter both email and password';
      return;
    }
    
    try {
      errorElement.textContent = '';
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      errorElement.textContent = getAuthErrorMessage(error);
    }
  }

  /**
   * Handles registration form submission
   */
  async function handleRegister(): Promise<void> {
    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;
    const errorElement = document.getElementById('register-error');
    
    if (!emailInput || !passwordInput || !confirmPasswordInput || !errorElement) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (!email || !password || !confirmPassword) {
      errorElement.textContent = 'Please fill in all fields';
      return;
    }
    
    if (password !== confirmPassword) {
      errorElement.textContent = 'Passwords do not match';
      return;
    }
    
    if (password.length < 6) {
      errorElement.textContent = 'Password must be at least 6 characters';
      return;
    }
    
    try {
      errorElement.textContent = '';
      const auth = getAuth();
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      errorElement.textContent = getAuthErrorMessage(error);
    }
  }

  /**
   * Handles Google login/registration
   */
  async function handleGoogleLogin(): Promise<void> {
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google login error:', error);
      const errorElement = document.getElementById('login-error') || document.getElementById('register-error');
      if (errorElement) {
        errorElement.textContent = getAuthErrorMessage(error);
      }
    }
  }

  /**
   * Handles user logout
   */
  async function handleLogout(): Promise<void> {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Converts Firebase auth errors to user-friendly messages
   * 
   * @param error - Firebase auth error
   * @returns User-friendly error message
   */
  function getAuthErrorMessage(error: any): string {
    const errorCode = error.code || '';
    
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password';
      case 'auth/email-already-in-use':
        return 'Email is already in use';
      case 'auth/weak-password':
        return 'Password is too weak';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled';
      case 'auth/network-request-failed':
        return 'Network error, please try again';
      default:
        return error.message || 'An error occurred during authentication';
    }
  }

  // Initial render
  renderAuthUI();

  // Return public interface
  return {
    showLoginView,
    showRegisterView,
    refresh: renderAuthUI,
    onAuthStateChange
  };
} 