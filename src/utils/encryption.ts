// Simple encryption/decryption helper using XOR and Base64 to obfuscate stored API keys
const SALT = "dufuka-pos-secure-salt-2026";

export function encryptApiKey(key: string): string {
  if (!key) return "";
  let result = "";
  for (let i = 0; i < key.length; i++) {
    const charCode = key.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result);
}

export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return "";
  try {
    const decoded = atob(encrypted);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    // If it's not base64 encoded (legacy plain text key), return as is
    return encrypted;
  }
}
