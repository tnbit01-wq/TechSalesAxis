const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const API_FALLBACK_URLS = [
  API_URL,
  "http://127.0.0.1:8000",
  "http://localhost:8000",
].filter((value, index, arr) => arr.indexOf(value) === index);

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWithFallback(path: string, options: FetchOptions) {
  let lastError: unknown = null;

  for (const baseUrl of API_FALLBACK_URLS) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await safeJson(response);
        const detail =
          error && typeof error.detail === "object"
            ? JSON.stringify(error.detail)
            : error?.detail;

        const apiError = new Error(
          detail || `Request failed with status ${response.status}`,
        ) as Error & { status?: number; url?: string };
        apiError.status = response.status;
        apiError.url = url;
        throw apiError;
      }

      return response;
    } catch (err) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          /Failed to fetch|NetworkError|Load failed/i.test(err.message));

      lastError = err;
      if (!isNetworkError) {
        // Only log network-level retries/errors, don't spam API validation errors
        throw err;
      }

      console.warn(`Network retry for ${url}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

export const apiClient = {
  async post(path: string, body: unknown, token?: string, options: any = {}) {
    const url = `${API_URL}${path}`;
    const headers: Record<string, string> = {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetchWithFallback(path, {
        method: "POST",
        headers,
        body: body instanceof FormData ? (body as any) : JSON.stringify(body),
      });

      return response.json();
    } catch (err) {
      throw err;
    }
  },

  async patch(path: string, body: unknown, token?: string) {
    const url = `${API_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetchWithFallback(path, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      return response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`API PATCH Error [${url}]:`, errorMessage);
      throw err;
    }
  },

  async get(path: string, token?: string) {
    const url = `${API_URL}${path}`;
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetchWithFallback(path, {
        headers,
      });

      return response.json();
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Filter out security/block errors from console pollution
      const isBlockedError = err.status === 403 || (errorMessage && errorMessage.includes("blocked"));
      
      if (!isBlockedError) {
        console.error(`API GET Error [${url}]:`, errorMessage);
      }
      
      throw err;
    }
  },

  async delete(path: string, token?: string) {
    const url = `${API_URL}${path}`;
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetchWithFallback(path, {
        method: "DELETE",
        headers,
      });

      return response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`API DELETE Error [${url}]:`, errorMessage);
      throw err;
    }
  },

  async request(method: string, path: string, body: unknown, token?: string) {
    const url = `${API_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetchWithFallback(path, {
        method: method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      return response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`API ${method} Error [${url}]:`, errorMessage);
      throw err;
    }
  },
};
