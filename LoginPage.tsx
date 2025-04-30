// src/pages/LoginPage.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Updated API call function
const loginUser = async (email, password) => {
  console.log("Attempting login with:", email);
  // Actual API call to backend /api/auth/login
  const response = await fetch("/api/auth/login", { // Assuming backend runs on the same origin or proxy is configured
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // Handle cases where the response is not valid JSON (e.g., plain text error)
      errorData = { message: `Login failed with status: ${response.status}` };
    }
    console.error("Login API error:", errorData);
    throw new Error(errorData.message || "Login failed");
  }

  const data = await response.json();
  console.log("Login API success:", data);
  return data; // Should return { access_token, refresh_token, user: { ... } }
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      console.log("Login successful:", data);
      // Store tokens and user info (use context later)
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      // Ensure user object and is_admin property exist before accessing
      if (data.user && typeof data.user.is_admin !== 'undefined') {
        localStorage.setItem('user_role', data.user.is_admin ? 'admin' : 'user'); // Store role
        // Redirect based on role
        if (data.user.is_admin) {
            navigate('/admin/dashboard');
        } else {
            navigate('/dashboard');
        }
      } else {
        console.error("User data or role missing in login response:", data);
        setError("Login response incomplete. Please contact support.");
        // Potentially navigate to a generic page or stay on login
      }
    } catch (err) {
      console.error("Login handleSubmit error:", err);
      setError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Access your AntiClone Shield account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-2">
        <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
          Forgot password?
        </Link>
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            Register here
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default LoginPage;

