import { registerWithEmail } from '../../services/firebase/auth-service';

/**
 * Create a registration UI component
 * @param container - The HTML element to render the registration UI into
 */
export function createRegisterUI(container: HTMLElement) {
  // Clear existing content
  container.innerHTML = '';
  
  // Create registration form
  const registerForm = document.createElement('div');
  registerForm.className = 'register-container';
  
  // Title
  const title = document.createElement('h2');
  title.textContent = 'Create an Account';
  title.className = 'register-title';
  registerForm.appendChild(title);
  
  // Email input
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = 'Email';
  emailInput.className = 'register-input';
  registerForm.appendChild(emailInput);
  
  // Display name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Display Name (optional)';
  nameInput.className = 'register-input';
  registerForm.appendChild(nameInput);
  
  // Password input
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Password (min 6 characters)';
  passwordInput.className = 'register-input';
  registerForm.appendChild(passwordInput);
  
  // Confirm password input
  const confirmPasswordInput = document.createElement('input');
  confirmPasswordInput.type = 'password';
  confirmPasswordInput.placeholder = 'Confirm Password';
  confirmPasswordInput.className = 'register-input';
  registerForm.appendChild(confirmPasswordInput);
  
  // Error message container
  const errorMsg = document.createElement('div');
  errorMsg.className = 'error-message';
  errorMsg.style.display = 'none';
  registerForm.appendChild(errorMsg);
  
  // Register button
  const registerButton = document.createElement('button');
  registerButton.textContent = 'Register';
  registerButton.className = 'register-button';
  registerButton.addEventListener('click', async () => {
    // Hide previous error
    errorMsg.style.display = 'none';
    
    // Validate inputs
    if (!emailInput.value) {
      errorMsg.textContent = 'Please enter an email address.';
      errorMsg.style.display = 'block';
      return;
    }
    
    if (!passwordInput.value) {
      errorMsg.textContent = 'Please enter a password.';
      errorMsg.style.display = 'block';
      return;
    }
    
    if (passwordInput.value.length < 6) {
      errorMsg.textContent = 'Password must be at least 6 characters.';
      errorMsg.style.display = 'block';
      return;
    }
    
    if (passwordInput.value !== confirmPasswordInput.value) {
      errorMsg.textContent = 'Passwords do not match.';
      errorMsg.style.display = 'block';
      return;
    }
    
    // Disable button during registration
    registerButton.disabled = true;
    registerButton.textContent = 'Creating account...';
    
    try {
      // Attempt registration
      const result = await registerWithEmail(
        emailInput.value, 
        passwordInput.value,
        nameInput.value || undefined
      );
      
      if (!result.success) {
        errorMsg.textContent = result.error?.message || 'Registration failed.';
        errorMsg.style.display = 'block';
      } else {
        // Registration successful
        container.dispatchEvent(new CustomEvent('register-success'));
      }
    } catch (error) {
      errorMsg.textContent = 'An unexpected error occurred.';
      errorMsg.style.display = 'block';
      console.error('[WordStream] Registration error:', error);
    } finally {
      // Re-enable button
      registerButton.disabled = false;
      registerButton.textContent = 'Register';
    }
  });
  registerForm.appendChild(registerButton);
  
  // Login link
  const loginLink = document.createElement('div');
  loginLink.innerHTML = "Already have an account? <a href='#'>Sign in</a>";
  loginLink.className = 'login-link';
  loginLink.querySelector('a')?.addEventListener('click', (e) => {
    e.preventDefault();
    container.dispatchEvent(new CustomEvent('show-login'));
  });
  registerForm.appendChild(loginLink);
  
  // Add to container
  container.appendChild(registerForm);
  
  // Focus email input
  emailInput.focus();
  
  // Add keydown event to submit form on Enter
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      registerButton.click();
    }
  };
  
  emailInput.addEventListener('keydown', handleKeydown);
  nameInput.addEventListener('keydown', handleKeydown);
  passwordInput.addEventListener('keydown', handleKeydown);
  confirmPasswordInput.addEventListener('keydown', handleKeydown);
  
  // Return cleanup function
  return () => {
    emailInput.removeEventListener('keydown', handleKeydown);
    nameInput.removeEventListener('keydown', handleKeydown);
    passwordInput.removeEventListener('keydown', handleKeydown);
    confirmPasswordInput.removeEventListener('keydown', handleKeydown);
  };
} 