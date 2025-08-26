// Security validation utilities

// Brazilian CPF validation with checksum
export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/[^\d]/g, '');
  
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false; // All same digits
  
  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  const firstDigit = 11 - (sum % 11);
  const validFirstDigit = firstDigit >= 10 ? 0 : firstDigit;
  
  if (parseInt(cleanCPF.charAt(9)) !== validFirstDigit) return false;
  
  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  const secondDigit = 11 - (sum % 11);
  const validSecondDigit = secondDigit >= 10 ? 0 : secondDigit;
  
  return parseInt(cleanCPF.charAt(10)) === validSecondDigit;
};

// Enhanced Brazilian CNPJ validation with full checksum algorithm
export const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false; // All same digits
  
  // Calculate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += parseInt(cleanCNPJ.charAt(i)) * weights1[i];
  }
  const digit1 = 11 - (sum1 % 11);
  const validDigit1 = digit1 >= 10 ? 0 : digit1;
  
  if (parseInt(cleanCNPJ.charAt(12)) !== validDigit1) return false;
  
  // Calculate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += parseInt(cleanCNPJ.charAt(i)) * weights2[i];
  }
  const digit2 = 11 - (sum2 % 11);
  const validDigit2 = digit2 >= 10 ? 0 : digit2;
  
  return parseInt(cleanCNPJ.charAt(13)) === validDigit2;
};

// PIX key validation with enhanced security
export const validatePixKey = (pixKey: string, type?: string): boolean => {
  const clean = pixKey.trim();
  
  if (!clean) return false;
  
  // CPF format
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(clean) || /^\d{11}$/.test(clean)) {
    return validateCPF(clean);
  }
  
  // CNPJ format with proper validation
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(clean) || /^\d{14}$/.test(clean)) {
    return validateCNPJ(clean);
  }
  
  // Email format with enhanced validation
  if (clean.includes('@')) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(clean) && clean.length <= 254;
  }
  
  // Brazilian phone format validation
  if (/^\+?[\d\s()-]+$/.test(clean)) {
    const digits = clean.replace(/[^\d]/g, '');
    // Brazilian phone: 10-11 digits (with area code)
    if (digits.length === 10 || digits.length === 11) {
      // Check if starts with valid area code (11-99)
      const areaCode = parseInt(digits.substring(0, 2));
      return areaCode >= 11 && areaCode <= 99;
    }
    return false;
  }
  
  // Random key (UUID format or 32 chars alphanumeric)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clean)) {
    return true;
  }
  
  if (/^[a-zA-Z0-9]{32}$/.test(clean)) {
    return true;
  }
  
  return false;
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>\"'&]/g, '') // Remove potential XSS characters
    .slice(0, 255); // Limit length
};

// Amount validation for payments
export const validatePaymentAmount = (amount: number, min = 1, max = 10000): boolean => {
  return Number.isInteger(amount) && amount >= min && amount <= max;
};

// Enhanced device fingerprinting for anti-abuse
export const generateDeviceFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
  }
  
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    canvas.toDataURL(),
    String(navigator.hardwareConcurrency || 0),
    String((navigator as any).deviceMemory || 0)
  ].join('|');
  
  const hashString = (str: string, seed = 0): string => {
    let h = 2166136261 ^ seed; // FNV-1a-like
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36).padStart(8, '0');
  };
  
  const fp = (
    hashString(parts, 0) +
    hashString(parts, 101) +
    hashString(parts.split('').reverse().join(''), 202)
  )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  
  // Ensure minimum length for backend validation (>= 16)
  return fp.slice(0, 24);
};

// Enhanced browser fingerprinting with more data points
export const generateAdvancedBrowserFingerprint = (): string => {
  try {
    const fingerprints: string[] = [];
    
    // Basic browser info
    fingerprints.push(navigator.userAgent || '');
    fingerprints.push(navigator.language || '');
    fingerprints.push(String(navigator.cookieEnabled));
    fingerprints.push(String(navigator.onLine));
    
    // Screen and display
    fingerprints.push(`${screen.width}x${screen.height}`);
    fingerprints.push(String(screen.colorDepth));
    fingerprints.push(String(screen.pixelDepth));
    fingerprints.push(String(window.devicePixelRatio || 1));
    
    // Timezone and locale
    fingerprints.push(String(new Date().getTimezoneOffset()));
    fingerprints.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    
    // Hardware capabilities
    fingerprints.push(String(navigator.hardwareConcurrency || 0));
    fingerprints.push(String((navigator as any).deviceMemory || 0));
    fingerprints.push(String((navigator as any).maxTouchPoints || 0));
    
    // Connection info
    const connection = (navigator as any).connection;
    if (connection) {
      fingerprints.push(String(connection.effectiveType || ''));
      fingerprints.push(String(connection.downlink || 0));
    }
    
    // Canvas fingerprint with multiple contexts
    const canvas = document.createElement('canvas');
    const ctx2d = canvas.getContext('2d');
    if (ctx2d) {
      ctx2d.textBaseline = 'top';
      ctx2d.font = '14px Arial';
      ctx2d.fillText('🎮 SpritePay Security', 2, 2);
      fingerprints.push(canvas.toDataURL());
    }
    
    // WebGL fingerprint
    try {
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl') as WebGLRenderingContext || 
                 glCanvas.getContext('experimental-webgl') as WebGLRenderingContext;
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          fingerprints.push(String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || ''));
          fingerprints.push(String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''));
        }
      }
    } catch (e) {
      // Ignore WebGL errors
    }
    
    // Audio context fingerprint
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const analyser = audioCtx.createAnalyser();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 1000;
      gainNode.gain.value = 0;
      
      fingerprints.push(String(audioCtx.sampleRate));
      fingerprints.push(String(analyser.frequencyBinCount));
      
      audioCtx.close();
    } catch (e) {
      // Ignore audio context errors
    }
    
    // Combine all fingerprints
    const combined = fingerprints.join('|');
    
    // Create a stable hash
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36).padStart(8, '0');
  } catch (error) {
    // Fallback to basic fingerprint
    return generateDeviceFingerprint().slice(0, 8);
  }
};

// LocalStorage security keys management
export const SECURITY_KEYS = {
  DEVICE_ID: 'spritepay_device_id',
  FIRST_VISIT: 'spritepay_first_visit',
  CREDITS_CLAIMED: 'spritepay_credits_claimed',
  BROWSER_HASH: 'spritepay_browser_hash',
  SECURITY_HASH: 'spritepay_security_hash'
};

// Generate localStorage security hash
export const generateLocalStorageHash = (): string => {
  try {
    const securityData = {
      deviceId: localStorage.getItem(SECURITY_KEYS.DEVICE_ID) || generateDeviceFingerprint(),
      firstVisit: localStorage.getItem(SECURITY_KEYS.FIRST_VISIT) || Date.now().toString(),
      browserHash: generateAdvancedBrowserFingerprint(),
      timestamp: Date.now()
    };
    
    // Store security data
    localStorage.setItem(SECURITY_KEYS.DEVICE_ID, securityData.deviceId);
    localStorage.setItem(SECURITY_KEYS.FIRST_VISIT, securityData.firstVisit);
    localStorage.setItem(SECURITY_KEYS.BROWSER_HASH, securityData.browserHash);
    
    // Generate combined hash
    const combined = JSON.stringify(securityData);
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    
    const securityHash = Math.abs(hash).toString(36);
    localStorage.setItem(SECURITY_KEYS.SECURITY_HASH, securityHash);
    
    return securityHash;
  } catch (error) {
    // Fallback if localStorage is not available
    return generateDeviceFingerprint().slice(0, 8);
  }
};

// Check if credits were already claimed on this device
export const checkCreditsAlreadyClaimed = (): boolean => {
  try {
    return localStorage.getItem(SECURITY_KEYS.CREDITS_CLAIMED) === 'true';
  } catch (error) {
    return false;
  }
};

// Mark credits as claimed in localStorage
export const markCreditsAsClaimed = (): void => {
  try {
    localStorage.setItem(SECURITY_KEYS.CREDITS_CLAIMED, 'true');
  } catch (error) {
    // Ignore localStorage errors
  }
};

// Detect potential abuse patterns in localStorage
export const detectLocalStorageAbuse = (): { suspicious: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  
  try {
    const deviceId = localStorage.getItem(SECURITY_KEYS.DEVICE_ID);
    const firstVisit = localStorage.getItem(SECURITY_KEYS.FIRST_VISIT);
    const creditsClaimed = localStorage.getItem(SECURITY_KEYS.CREDITS_CLAIMED);
    
    // Check for missing or suspicious data
    if (!deviceId || deviceId.length < 8) {
      reasons.push('Device ID inválido ou ausente');
    }
    
    if (!firstVisit) {
      reasons.push('Data de primeira visita ausente');
    } else {
      const firstVisitTime = parseInt(firstVisit);
      const now = Date.now();
      
      // Check if first visit is too recent (might be a fresh account)
      if (now - firstVisitTime < 60000) { // Less than 1 minute
        reasons.push('Conta muito recente');
      }
    }
    
    // Check for cleared localStorage (potential abuse attempt)
    if (creditsClaimed === 'true' && (!deviceId || !firstVisit)) {
      reasons.push('Dados de segurança inconsistentes');
    }
    
    return {
      suspicious: reasons.length > 0,
      reasons
    };
  } catch (error) {
    return {
      suspicious: true,
      reasons: ['Erro ao verificar localStorage']
    };
  }
};

// Rate limiting helper
export const createRateLimiter = (windowMs: number, maxRequests: number) => {
  const requests = new Map<string, number[]>();
  
  return (key: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const keyRequests = requests.get(key)!;
    
    // Remove old requests outside the window
    while (keyRequests.length > 0 && keyRequests[0] < windowStart) {
      keyRequests.shift();
    }
    
    // Check if limit exceeded
    if (keyRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    keyRequests.push(now);
    return true;
  };
};