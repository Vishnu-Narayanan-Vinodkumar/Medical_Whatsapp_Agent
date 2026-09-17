const crypto = require('node:crypto');

function createSecurity(hexKey) {
  const key = Buffer.from(hexKey, 'hex');
  return {
    hash(value) { return crypto.createHmac('sha256', key).update(value).digest('hex'); },
    seal(value) {
      const nonce = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64');
    },
    open(value) {
      const data = Buffer.from(value, 'base64');
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8'));
    },
  };
}

const token = () => crypto.randomBytes(32).toString('hex');
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPassword = value => typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value) <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

module.exports = { createSecurity, token, validEmail, validPassword };