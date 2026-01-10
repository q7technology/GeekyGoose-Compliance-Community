/**
 * Shared API utilities and hooks for the GeekyGoose Compliance application.
 * Provides consistent error handling and retry logic.
 */

import { useState, useEffect, useCallback } from 'react';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Enhanced fetch with error handling and retries.
 * @param url - API endpoint
 * @param options - Fetch options
 * @param retries - Number of retry attempts
 * @returns Promise with response data
 */
export async function apiRequest<T = any>(
  url: string, 
  options: RequestInit = {},
  retries: number = 3
): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(fullUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      // Only retry on network errors or 5xx status codes
      if (error instanceof APIError && error.status < 500) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * GET request utility.
 * @param url - API endpoint
 * @returns Promise with response data
 */
export function apiGet<T = any>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'GET' });
}

/**
 * POST request utility.
 * @param url - API endpoint
 * @param data - Request body data
 * @returns Promise with response data
 */
export function apiPost<T = any>(url: string, data?: any): Promise<T> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request utility.
 * @param url - API endpoint
 * @param data - Request body data
 * @returns Promise with response data
 */
export function apiPut<T = any>(url: string, data?: any): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request utility.
 * @param url - API endpoint
 * @returns Promise with response data
 */
export function apiDelete<T = any>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'DELETE' });
}

/**
 * File upload utility with progress tracking.
 * @param url - Upload endpoint
 * @param file - File to upload
 * @param onProgress - Progress callback
 * @returns Promise with upload response
 */
export function uploadFile<T = any>(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          resolve(xhr.responseText as any);
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new APIError(
            errorData.message || `Upload failed with status ${xhr.status}`,
            xhr.status,
            errorData
          ));
        } catch (error) {
          reject(new APIError(`Upload failed with status ${xhr.status}`, xhr.status));
        }
      }
    };
    
    xhr.onerror = () => {
      reject(new APIError('Upload failed due to network error', 0));
    };
    
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    xhr.open('POST', fullUrl);
    xhr.send(formData);
  });
}

/**
 * Hook for fetching data with loading and error states.
 * @param url - API endpoint
 * @param dependencies - Dependencies to trigger refetch
 * @returns Object with data, loading, error, and refetch function
 */
export function useApi<T = any>(url: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet<T>(url);
      setData(response);
    } catch (err) {
      console.error('API request failed:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);
  
  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for handling mutations with loading and error states.
 * @returns Object with mutate function, loading, and error states
 */
export function useMutation<T = any, P = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mutate = useCallback(async (
    mutationFn: (params: P) => Promise<T>,
    params: P
  ): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await mutationFn(params);
      return result;
    } catch (err) {
      console.error('Mutation failed:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    mutate,
    loading,
    error,
  };
}

/**
 * Utility to handle API errors consistently.
 * @param error - Error object
 * @returns User-friendly error message
 */
export function getErrorMessage(error: any): string {
  if (error instanceof APIError) {
    return error.message;
  }
  
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Utility to check if an error is a network error.
 * @param error - Error object
 * @returns True if it's a network error
 */
export function isNetworkError(error: any): boolean {
  return !navigator.onLine || 
         error?.code === 'NETWORK_ERROR' ||
         error?.message?.includes('Network Error') ||
         error?.message?.includes('Failed to fetch');
}

/**
 * Debounced API request utility.
 * @param fn - API function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced function
 */
export function debounceApi<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  delay: number
): (...args: T) => Promise<R> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: T): Promise<R> => {
    clearTimeout(timeoutId);
    
    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}