/**
 * Date Validation Utilities
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get minimum date (today)
 */
export const getMinDeliveryDate = () => {
  return getTodayDate();
};

/**
 * Get maximum date (1 year from now)
 */
export const getMaxDeliveryDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
};

/**
 * Check if date is in the past
 */
export const isPastDate = (dateString) => {
  const selected = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return selected < today;
};

/**
 * Check if delivery date and time is in the past
 */
export const isPastDateTime = (dateString, timeString) => {
  if (!dateString || !timeString) return false;
  
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    const deliveryDateTime = new Date(dateString);
    deliveryDateTime.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    
    return deliveryDateTime <= now;
  } catch (error) {
    return false;
  }
};

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  
  return date.toLocaleDateString('en-IN', options);
};

/**
 * Format date and time for display
 */
export const formatDateTime = (dateString, timeString) => {
  if (!dateString || !timeString) return '';
  
  return `${formatDate(dateString)} at ${formatTime(timeString)}`;
};

/**
 * Format time for display (24h to 12h)
 */
export const formatTime = (timeString) => {
  if (!timeString) return '';
  
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (error) {
    return timeString;
  }
};

/**
 * Get relative time (e.g., "2 hours ago")
 */
export const getRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(dateString);
};

/**
 * Check if date is today
 */
export const isToday = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  
  return date.toDateString() === today.toDateString();
};

/**
 * Check if date is tomorrow
 */
export const isTomorrow = (dateString) => {
  const date = new Date(dateString);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return date.toDateString() === tomorrow.toDateString();
};

/**
 * Get day name from date
 */
export const getDayName = (dateString) => {
  const date = new Date(dateString);
  const options = { weekday: 'long' };
  
  return date.toLocaleDateString('en-IN', options);
};
