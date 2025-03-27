import { loginWithEmail, loginWithGoogle } from '../../services/firebase/auth-service';

/**
 * Create a login UI component
 * @param container - The HTML element to render the login UI into
 */
export function createLoginUI(container: HTMLElement) {
  // Clear existing content
  container.innerHTML = '';
  
  // Create login form
  const loginForm = document.createElement('div');
  loginForm.className = 'login-container';
  
  // Title
  const title = document.createElement('h2');
  title.textContent = 'Sign in to WordStream';
  title.className = 'login-title';
  loginForm.appendChild(title);
  
  // Email input
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = 'Email';
  emailInput.className = 'login-input';
  loginForm.appendChild(emailInput);
  
  // Password input
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Password';
  passwordInput.className = 'login-input';
  loginForm.appendChild(passwordInput);
  
  // Error message container
  const errorMsg = document.createElement('div');
  errorMsg.className = 'error-message';
  errorMsg.style.display = 'none';
  loginForm.appendChild(errorMsg);
  
  // Login button
  const loginButton = document.createElement('button');
  loginButton.textContent = 'Sign In';
  loginButton.className = 'login-button';
  loginButton.addEventListener('click', async () => {
    // Hide previous error
    errorMsg.style.display = 'none';
    
    // Validate inputs
    if (!emailInput.value || !passwordInput.value) {
      errorMsg.textContent = 'Please enter both email and password.';
      errorMsg.style.display = 'block';
      return;
    }
    
    // Disable button during login
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
    
    try {
      // Attempt login
      const result = await loginWithEmail(emailInput.value, passwordInput.value);
      
      if (!result.success) {
        errorMsg.textContent = result.error?.message || 'Login failed.';
        errorMsg.style.display = 'block';
      } else {
        // Login successful
        container.dispatchEvent(new CustomEvent('login-success'));
      }
    } catch (error) {
      errorMsg.textContent = 'An unexpected error occurred.';
      errorMsg.style.display = 'block';
      console.error('[WordStream] Login error:', error);
    } finally {
      // Re-enable button
      loginButton.disabled = false;
      loginButton.textContent = 'Sign In';
    }
  });
  loginForm.appendChild(loginButton);
  
  // Google sign-in button
  const googleButton = document.createElement('button');
  googleButton.textContent = 'Sign in with Google';
  googleButton.className = 'google-button';
  googleButton.addEventListener('click', async () => {
    googleButton.disabled = true;
    googleButton.textContent = 'Connecting...';
    
    try {
      const result = await loginWithGoogle();
      
      if (!result.success) {
        errorMsg.textContent = result.error?.message || 'Google login failed.';
        errorMsg.style.display = 'block';
      } else {
        container.dispatchEvent(new CustomEvent('login-success'));
      }
    } catch (error) {
      errorMsg.textContent = 'An unexpected error occurred.';
      errorMsg.style.display = 'block';
      console.error('[WordStream] Google login error:', error);
    } finally {
      googleButton.disabled = false;
      googleButton.textContent = 'Sign in with Google';
    }
  });
  loginForm.appendChild(googleButton);
  
  // Separator
  const separator = document.createElement('div');
  separator.className = 'separator';
  separator.innerHTML = '<span>or</span>';
  loginForm.appendChild(separator);
  
  // Register link
  const registerLink = document.createElement('div');
  registerLink.innerHTML = "Don't have an account? <a href='#'>Register</a>";
  registerLink.className = 'register-link';
  registerLink.querySelector('a')?.addEventListener('click', (e) => {
    e.preventDefault();
    container.dispatchEvent(new CustomEvent('show-register'));
  });
  loginForm.appendChild(registerLink);
  
  // Add to container
  container.appendChild(loginForm);
  
  // Focus email input
  emailInput.focus();
  
  // Add keydown event to submit form on Enter
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      loginButton.click();
    }
  };
  
  emailInput.addEventListener('keydown', handleKeydown);
  passwordInput.addEventListener('keydown', handleKeydown);
  
  // Return cleanup function
  return () => {
    emailInput.removeEventListener('keydown', handleKeydown);
    passwordInput.removeEventListener('keydown', handleKeydown);
  };
} 