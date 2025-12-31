/**
 * Shared utility functions for formatting data across the application.
 * Reduces code duplication and ensures consistency.
 */

/**
 * Formats a file size in bytes to a human-readable string.
 * @param bytes - The file size in bytes
 * @returns Formatted file size string (e.g., "1.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats a date string to a localized format.
 * @param dateString - ISO date string
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string, 
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (error) {
    console.warn('Invalid date string:', dateString);
    return 'Invalid date';
  }
}

/**
 * Formats a relative time string (e.g., "2 hours ago").
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(dateString, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (error) {
    console.warn('Invalid date string:', dateString);
    return 'Unknown';
  }
}

/**
 * Gets an appropriate emoji icon for a file type.
 * @param mimeType - MIME type of the file
 * @returns Emoji representing the file type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('text')) return '📃';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️';
  return '📁';
}

/**
 * Formats a confidence percentage with appropriate styling classes.
 * @param confidence - Confidence value between 0 and 1
 * @returns Object with formatted percentage and CSS classes
 */
export function formatConfidence(confidence: number): { 
  percentage: string; 
  colorClass: string;
  bgClass: string;
} {
  const percentage = Math.round(confidence * 100);
  
  let colorClass = '';
  let bgClass = '';
  
  if (percentage >= 80) {
    colorClass = 'text-green-800';
    bgClass = 'bg-green-100';
  } else if (percentage >= 60) {
    colorClass = 'text-yellow-800';
    bgClass = 'bg-yellow-100';
  } else {
    colorClass = 'text-orange-800';
    bgClass = 'bg-orange-100';
  }
  
  return {
    percentage: `${percentage}%`,
    colorClass,
    bgClass
  };
}

/**
 * Truncates text to a specified length with ellipsis.
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Capitalizes the first letter of each word in a string.
 * @param text - Text to capitalize
 * @returns Capitalized text
 */
export function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Formats a control code for display (e.g., "EE-1" -> "EE-1").
 * @param code - Control code
 * @returns Formatted control code
 */
export function formatControlCode(code: string): string {
  return code.toUpperCase().trim();
}

/**
 * Sanitizes text for safe HTML display.
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}