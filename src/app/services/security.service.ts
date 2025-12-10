import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Serviço de Segurança para proteger dados sensíveis do usuário
 * 
 * Implementa:
 * - Criptografia de dados em localStorage usando AES-GCM
 * - Proteção contra XSS
 * - Expiração automática de tokens
 * - Sanitização de dados
 */
@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  
  // Chave derivada do navegador (única por dispositivo)
  private encryptionKey: CryptoKey | null = null;
  private readonly KEY_STORAGE = 'pm_security_key';
  private readonly TOKEN_EXPIRY_HOURS = 24; // Tokens expiram em 24 horas

  constructor() {
    this.initializeEncryption();
  }

  /**
   * Inicializa a chave de criptografia
   */
  private async initializeEncryption(): Promise<void> {
    try {
      // Verificar se já existe uma chave salva
      const savedKeyData = sessionStorage.getItem(this.KEY_STORAGE);
      
      if (savedKeyData) {
        // Importar chave existente
        const keyData = JSON.parse(savedKeyData);
        this.encryptionKey = await crypto.subtle.importKey(
          'jwk',
          keyData,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
      } else {
        // Gerar nova chave
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        // Salvar chave na sessionStorage (mais seguro que localStorage)
        const exportedKey = await crypto.subtle.exportKey('jwk', this.encryptionKey);
        sessionStorage.setItem(this.KEY_STORAGE, JSON.stringify(exportedKey));
      }
    } catch (error) {
      console.error('Erro ao inicializar criptografia:', error);
      // Fallback para modo sem criptografia (menos seguro)
      this.encryptionKey = null;
    }
  }

  /**
   * Criptografa dados sensíveis
   */
  async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      await this.initializeEncryption();
    }

    if (!this.encryptionKey) {
      // Fallback: Base64 encoding (menos seguro, mas funcional)
      return btoa(encodeURIComponent(data));
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Gerar IV aleatório
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Criptografar
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        dataBuffer
      );

      // Combinar IV + dados criptografados
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Converter para Base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Erro ao criptografar:', error);
      return btoa(encodeURIComponent(data));
    }
  }

  /**
   * Descriptografa dados
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      await this.initializeEncryption();
    }

    if (!this.encryptionKey) {
      // Fallback: Base64 decoding
      try {
        return decodeURIComponent(atob(encryptedData));
      } catch {
        return encryptedData;
      }
    }

    try {
      // Decodificar Base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // Extrair IV e dados
      const iv = combined.slice(0, 12);
      const encryptedBuffer = combined.slice(12);

      // Descriptografar
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Erro ao descriptografar:', error);
      // Tentar fallback
      try {
        return decodeURIComponent(atob(encryptedData));
      } catch {
        return '';
      }
    }
  }

  /**
   * Salva dados de forma segura no localStorage
   */
  async secureStore(key: string, data: any, expiryHours?: number): Promise<void> {
    const payload = {
      data,
      timestamp: Date.now(),
      expiry: expiryHours ? Date.now() + (expiryHours * 60 * 60 * 1000) : null
    };

    const encrypted = await this.encrypt(JSON.stringify(payload));
    localStorage.setItem(key, encrypted);
  }

  /**
   * Recupera dados de forma segura do localStorage
   */
  async secureRetrieve<T>(key: string): Promise<T | null> {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;

    try {
      const decrypted = await this.decrypt(encrypted);
      const payload = JSON.parse(decrypted);

      // Verificar expiração
      if (payload.expiry && Date.now() > payload.expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return payload.data as T;
    } catch (error) {
      console.error('Erro ao recuperar dados seguros:', error);
      localStorage.removeItem(key);
      return null;
    }
  }

  /**
   * Remove dados do storage de forma segura
   */
  secureRemove(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * Sanitiza strings para prevenir XSS
   */
  sanitize(input: string): string {
    if (!input) return '';
    
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Sanitiza HTML perigoso
   */
  sanitizeHtml(html: string): string {
    if (!html) return '';

    // Remover scripts e event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  /**
   * Valida e sanitiza URLs
   */
  sanitizeUrl(url: string): string {
    if (!url) return '';

    try {
      const parsed = new URL(url);
      
      // Permitir apenas protocolos seguros
      if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
        return '';
      }

      // Bloquear javascript: URLs
      if (parsed.protocol === 'data:' && !parsed.href.startsWith('data:image/')) {
        return '';
      }

      return url;
    } catch {
      // URL inválida
      return '';
    }
  }

  /**
   * Gera um token CSRF
   */
  generateCsrfToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Limpa todos os dados sensíveis (logout completo)
   */
  clearAllSecureData(): void {
    // Chaves conhecidas
    const secureKeys = [
      'pm_google_token',
      'pm_google_user',
      'pm_security_key'
    ];

    secureKeys.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
  }

  /**
   * Verifica se o ambiente é seguro (HTTPS em produção)
   */
  isSecureContext(): boolean {
    return window.isSecureContext || window.location.hostname === 'localhost';
  }

  /**
   * Detecta possíveis ataques de XSS em inputs
   */
  detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /eval\(/i,
      /expression\(/i,
      /vbscript:/i
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Hash seguro de strings (para comparação, não para senhas)
   */
  async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Mascara dados sensíveis para exibição
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars * 2) return '****';
    return data.substring(0, visibleChars) + '****' + data.substring(data.length - visibleChars);
  }

  /**
   * Log seguro - só exibe em ambiente de desenvolvimento
   */
  secureLog(message: string, ...data: any[]): void {
    if (!environment.production) {
      console.log(message, ...data);
    }
  }

  /**
   * Log de erro seguro - exibe apenas mensagem genérica em produção
   */
  secureError(message: string, error: any): void {
    if (!environment.production) {
      console.error(message, error);
    } else {
      console.error('Ocorreu um erro. Por favor, tente novamente.');
    }
  }

  /**
   * Valida força de senha
   */
  validatePasswordStrength(password: string): { 
    valid: boolean; 
    score: number; 
    feedback: string[] 
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else feedback.push('Mínimo 8 caracteres');

    if (password.length >= 12) score++;
    
    if (/[a-z]/.test(password)) score++;
    else feedback.push('Incluir letra minúscula');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Incluir letra maiúscula');

    if (/[0-9]/.test(password)) score++;
    else feedback.push('Incluir número');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push('Incluir caractere especial');

    return {
      valid: score >= 4,
      score,
      feedback
    };
  }
}
