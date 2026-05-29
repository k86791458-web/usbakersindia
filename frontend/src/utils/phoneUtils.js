/**
 * Phone Validation Utilities
 */

export const validatePhone = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  const errors = [];
  
  // Check if empty
  if (!cleaned) {
    errors.push('Phone number is required');
    return { isValid: false, errors, cleaned };
  }
  
  // Check length - must be exactly 10 digits
  if (cleaned.length !== 10) {
    errors.push('Phone number must be exactly 10 digits');
  }
  
  // Check if starts with valid digit (6-9 for Indian mobile numbers)
  if (cleaned.length === 10 && !['6', '7', '8', '9'].includes(cleaned[0])) {
    errors.push('Phone number must start with 6, 7, 8, or 9');
  }
  
  // Check for all same digits
  if (cleaned.length === 10 && /^(\d)\1{9}$/.test(cleaned)) {
    errors.push('Phone number cannot be all same digits');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleaned,
    formatted: formatPhone(cleaned)
  };
};

/**
 * Format phone number for display
 * Example: 9876543210 -> +91 98765 43210
 */
export const formatPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  
  return phone;
};

/**
 * Format phone number as user types
 * Allows only digits and automatically formats
 */
export const formatPhoneInput = (value) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  return limited;
};

/**
 * Check if two phone numbers are the same
 */
export const arePhonesEqual = (phone1, phone2) => {
  const cleaned1 = phone1.replace(/\D/g, '');
  const cleaned2 = phone2.replace(/\D/g, '');
  
  return cleaned1 === cleaned2;
};
