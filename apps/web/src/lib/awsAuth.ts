/**
 * AWS Auth Client Logic
 * Standard JWT-based auth pointing to the Python API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const awsAuth = {
  /** /
   * Register a new user (Step 1: Code sent via SES)
   * Note: No password is sent here - user will set password after OTP verification
   */
  async signup(email: string, role: string, full_name: string = "User") {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, full_name }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Signup failed");
    }
    return response.json();
  },

  /**
   * Verify OTP and get temporary token (Step 2)
   * Returns a temporary token that can only be used to set password
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
      // Store temporary token separately - NOT as main login token
      localStorage.setItem("tf_temp_token", data.access_token);
      localStorage.setItem("tf_user_email", email);
    }
    return data;
  },

  /**
   * Complete signup by setting password (Step 3)
   * Exchanges temporary token for real access token
   */
  async completeSignup(password: string) {
    const tempToken = localStorage.getItem("tf_temp_token");
    if (!tempToken) {
      throw new Error("Session expired. Please start signup again.");
    }

    const response = await fetch(`${API_URL}/auth/update-password`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tempToken}`
      },
      body: JSON.stringify({ new_password: password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to set password");
    }

    const data = await response.json();
    if (data.access_token) {
      // Clear temporary token and save real token
      localStorage.removeItem("tf_temp_token");
      localStorage.setItem("tf_token", data.access_token);
    }
    return data;
  },

  /**
   * Get temporary token during signup (for checking session status)
   */
  getTempToken() {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tf_temp_token");
    }
    return null;
  },

  /**
   * Resume incomplete signup for user who verified OTP but hasn't set password
   */
  async resumeSignup(email: string, role: string) {
    const response = await fetch(`${API_URL}/auth/resume-signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to resume signup");
    }

    const data = await response.json();
    if (data.access_token) {
      // Store temporary token for password setup
      localStorage.setItem("tf_temp_token", data.access_token);
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
