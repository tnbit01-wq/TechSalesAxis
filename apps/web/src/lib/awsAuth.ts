/**
 * AWS Auth Client Logic
 * Standard JWT-based auth pointing to the Python API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const awsAuth = {
  /**
   * Register a new user (Step 1: Code sent via SES)
   */
  async signup(email: string, role: string, password = "DefaultPassword123!") {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Signup failed");
    }
    return response.json();
  },

  /**
   * Verify OTP and get JWT (Step 2)
   */
  async verifyOtp(email: string, otp: string) {
    const response = await fetch(`${API_URL}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Verification failed");
    }

    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem("tf_token", data.access_token);
      localStorage.setItem("tf_user_email", email);
    }
    return data;
  },

  /**
   * Standard Email/Password Login
   */
  async login(email: string, password: any) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
    }

    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem("tf_token", data.access_token);
      localStorage.setItem("tf_user_email", email);
    }
    return data;
  },

  /**
   * Check if user is logged in
   */
  getToken() {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tf_token");
    }
    return null;
  },

  /**
   * Get basic user info from storage
   */
  getUser() {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("tf_token");
      if (!token) return null;
      
      try {
        // Simple JWT decoding without a library (atob handles base64)
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        return {
          email: payload.email,
          id: payload.sub, // 'sub' contains the actual database UUID from AWS
        };
      } catch (err) {
        console.error("JWT decoding failed:", err);
        return null;
      }
    }
    return null;
  },

  logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tf_token");
      localStorage.removeItem("tf_user_email");
      window.location.href = "/login";
    }
  }
};
