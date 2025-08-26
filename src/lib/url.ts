/**
 * Dynamic URL utility for handling different environments
 * Works with Lovable domains and custom domains
 */
export const getBaseUrl = (): string => {
  // Always use current domain - works with any domain including custom domains
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // For server-side (should not happen in React apps), throw error to catch issues early
  throw new Error('getBaseUrl() called in server environment - use in browser only');
};

/**
 * Creates a referral link with the current domain pointing to signup page
 */
export const createReferralLink = (referralCode: string): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/signup?ref=${referralCode}`;
};

/**
 * Validates if a referral code has the correct format
 */
export const isValidReferralCode = (code: string): boolean => {
  // Referral codes should be 8 characters, alphanumeric
  return /^[A-Z0-9]{8}$/.test(code);
};

/**
 * Extracts referral code from URL parameters
 */
export const extractReferralCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode && isValidReferralCode(refCode)) {
    return refCode;
  }
  
  return null;
};