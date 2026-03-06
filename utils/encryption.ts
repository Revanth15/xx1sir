import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Generates a secure, 32-byte (256-bit) encryption key.
 * Run this once (e.g., in a standalone script or REPL) to generate a key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Encrypts a plain text string.
 * @param text - The plain text to encrypt
 * @param secretKey - The base64 encoded 32-byte key
 * @returns A string in the format "iv:authTag:encryptedText"
 */
export function encrypt(text: string, secretKey: string): string {
  // Generate a random 16-byte Initialization Vector (IV)
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(secretKey, 'base64');
  
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Combine IV, Auth Tag, and Ciphertext so we can extract them for decryption
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string.
 * @param hash - The formatted string "iv:authTag:encryptedText"
 * @param secretKey - The base64 encoded 32-byte key
 * @returns The decrypted plain text
 */
export function decrypt(hash: string, secretKey: string): string {
  const parts = hash.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const keyBuffer = Buffer.from(secretKey, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}