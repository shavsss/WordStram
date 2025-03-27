import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, KeyRound, AlertCircle } from 'lucide-react';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface Subscription {
  status: string;
  expiresAt?: string;
}

interface AuthFormProps {
  onAuthStateChange?: (isSignedIn: boolean, user?: User, subscription?: Subscription) => void;
  className?: string;
}

export function AuthForm({ onAuthStateChange, className = '' }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('signin');

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'sign_in_google'
      });
      
      if (response?.success) {
        // התחברות הצליחה
        if (onAuthStateChange && response.user) {
          onAuthStateChange(true, response.user, response.subscription);
          
          // הוסף הודעת הצלחה
          setSuccessMessage('התחברות עם Google הצליחה!');
        }
      } else {
        // התחברות נכשלה
        const errorMessage = response?.error || 'שגיאת התחברות לא ידועה';
        
        // בדוק אם זו שגיאת client ID
        if (errorMessage.includes('client') || errorMessage.includes('מזהה לקוח')) {
          setError('לא ניתן להתחבר עם Google כרגע. אנא השתמש באימייל וסיסמה.');
          // העבר אוטומטית לטאב של כניסה עם אימייל
          setActiveTab('signin');
        } else {
          setError(`שגיאת התחברות: ${errorMessage}`);
        }
      }
    } catch (err) {
      setError('שגיאת התחברות: לא ניתן להתחבר עם Google כרגע. אנא נסה באמצעות אימייל וסיסמה.');
      console.error('Google sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Email Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'sign_in_email',
        email,
        password
      });
      
      if (response?.success) {
        // התחברות הצליחה
        if (onAuthStateChange && response.user) {
          onAuthStateChange(true, response.user, response.subscription);
        }
      } else {
        // התחברות נכשלה
        setError(response?.error || 'אירעה שגיאה בתהליך ההתחברות');
      }
    } catch (error) {
      console.error('Email sign in error:', error);
      setError('אירעה שגיאה בתהליך ההתחברות');
    } finally {
      setIsLoading(false);
    }
  };

  // Email Sign Up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // וודא שהסיסמאות תואמות
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'sign_up_email',
        email,
        password
      });
      
      if (response?.success) {
        // הרשמה הצליחה
        if (onAuthStateChange && response.user) {
          onAuthStateChange(true, response.user, response.subscription);
          setSuccessMessage('נרשמת בהצלחה!');
        }
      } else {
        // הרשמה נכשלה
        setError(response?.error || 'אירעה שגיאה בתהליך ההרשמה');
      }
    } catch (error) {
      console.error('Email sign up error:', error);
      setError('אירעה שגיאה בתהליך ההרשמה');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'reset_password',
        email
      });
      
      if (response?.success) {
        setSuccessMessage('הוראות לאיפוס סיסמה נשלחו לכתובת המייל שלך');
      } else {
        setError(response?.error || 'אירעה שגיאה בתהליך איפוס הסיסמה');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('אירעה שגיאה בתהליך איפוס הסיסמה');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader>
        <CardTitle className="text-2xl text-center">WordStream</CardTitle>
        <CardDescription className="text-center">
          {activeTab === 'signin' && 'התחבר כדי להמשיך עם WordStream'}
          {activeTab === 'signup' && 'צור חשבון חדש ב-WordStream'}
          {activeTab === 'forgot' && 'איפוס סיסמה'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {successMessage && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <Tabs 
          defaultValue="signin" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">התחברות</TabsTrigger>
            <TabsTrigger value="signup">הרשמה</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleEmailSignIn} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="signin-password">סיסמה</Label>
                  <button
                    type="button"
                    className="text-xs text-blue-500 hover:underline"
                    onClick={() => setActiveTab('forgot')}
                    disabled={isLoading}
                  >
                    שכחת סיסמה?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    טוען...
                  </>
                ) : 'התחבר'}
              </Button>
            </form>
            
            {/* החזרת התחברות עם Google */}
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">או התחבר באמצעות</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="mt-3 w-full flex items-center justify-center"
              >
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                התחבר עם Google
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleEmailSignUp} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">סיסמה</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    טוען...
                  </>
                ) : 'הירשם'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="forgot">
            <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    טוען...
                  </>
                ) : 'שלח הוראות איפוס'}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => setActiveTab('signin')}
                disabled={isLoading}
              >
                חזרה להתחברות
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-gray-500">
        © WordStream - {new Date().getFullYear()}
      </CardFooter>
    </Card>
  );
}

export default AuthForm; 