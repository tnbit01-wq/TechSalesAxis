/**
 * AWS Auth Client Logic
 * Standard JWT-based auth pointing to the Python API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const awsAuth = {
  /** /
   * Register a new user (Step 1: Code sent via SES)
   */
  async signup(email: string, role: string, full_name: string = "User") {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, full_name, password: "placeholder" }),
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
  normalizeToken(rawToken: string | null): string | null {
    if (!rawToken) return null;
    let token = rawToken.trim();
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1).trim();
    }
    return token || null;
  },

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
    const token = this.normalizeToken(data.access_token);
    if (token) {
      localStorage.setItem("tf_token", token);
      localStorage.setItem("tf_user_email", email);
    }
    return data;
  },

  /**
   * Resend OTP if user requests it (expires in 2 minutes)
   */
  async resendOtp(email: string, role: string) {
    const response = await fetch(`${API_URL}/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to resend OTP");
    }
    return response.json();
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
    const token = awsAuth.normalizeToken(data.access_token);
    if (token) {
      localStorage.setItem("tf_token", token);
      localStorage.setItem("tf_user_email", email);
    }
    return data;
  },

  /**
   * Check if user is logged in
   */
  getToken() {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("tf_token");
      return awsAuth.normalizeToken(storedToken);
    }
    return null;
  },

  /**
   * Get basic user info from storage
   * Includes role when present in JWT payload.
   */
  getUser() {
    if (typeof window !== "undefined") {
      const token = this.getToken();
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
          role: payload.role,
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
      localStorage.removeItem("ai_chat_session_id");
      window.location.href = "/login";
    }
  }
};
