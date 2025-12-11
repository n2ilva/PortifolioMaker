import { Injectable } from '@angular/core';

export interface CompressionOptions {
  maxWidth?: number;      // Largura máxima em pixels
  maxHeight?: number;     // Altura máxima em pixels
  quality?: number;       // Qualidade JPEG (0.1 - 1.0)
  maxSizeKB?: number;     // Tamanho máximo em KB
}

export interface CompressionResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageCompressionService {
  
  // Configurações padrão para diferentes usos
  private readonly DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.85,
    maxSizeKB: 500
  };

  private readonly BACKGROUND_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    maxSizeKB: 300
  };

  private readonly THUMBNAIL_OPTIONS: CompressionOptions = {
    maxWidth: 400,
    maxHeight: 300,
    quality: 0.7,
    maxSizeKB: 50
  };

  /**
   * Comprime uma imagem a partir de um File
   */
  async compressFile(file: File, options?: CompressionOptions): Promise<CompressionResult> {
    const dataUrl = await this.fileToDataUrl(file);
    return this.compressDataUrl(dataUrl, options);
  }

  /**
   * Comprime uma imagem a partir de uma URL de dados (base64)
   */
  async compressDataUrl(dataUrl: string, options?: CompressionOptions): Promise<CompressionResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const originalSize = this.getBase64Size(dataUrl);
    
    // Carregar imagem
    const img = await this.loadImage(dataUrl);
    
    // Calcular novas dimensões mantendo proporção
    const { width, height } = this.calculateDimensions(
      img.naturalWidth, 
      img.naturalHeight, 
      opts.maxWidth!, 
      opts.maxHeight!
    );

    // Comprimir com qualidade inicial
    let compressedDataUrl = await this.resizeAndCompress(img, width, height, opts.quality!);
    let compressedSize = this.getBase64Size(compressedDataUrl);

    // Se ainda está muito grande, reduzir qualidade progressivamente
    let currentQuality = opts.quality!;
    while (compressedSize > opts.maxSizeKB! * 1024 && currentQuality > 0.3) {
      currentQuality -= 0.1;
      compressedDataUrl = await this.resizeAndCompress(img, width, height, currentQuality);
      compressedSize = this.getBase64Size(compressedDataUrl);
    }

    // Se ainda está grande, reduzir dimensões
    let currentWidth = width;
    let currentHeight = height;
    while (compressedSize > opts.maxSizeKB! * 1024 && currentWidth > 400) {
      currentWidth = Math.floor(currentWidth * 0.8);
      currentHeight = Math.floor(currentHeight * 0.8);
      compressedDataUrl = await this.resizeAndCompress(img, currentWidth, currentHeight, currentQuality);
      compressedSize = this.getBase64Size(compressedDataUrl);
    }

    return {
      dataUrl: compressedDataUrl,
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0,
      width: currentWidth,
      height: currentHeight
    };
  }

  /**
   * Comprime para uso como imagem de slide (qualidade alta)
   */
  async compressForSlide(dataUrl: string): Promise<string> {
    const result = await this.compressDataUrl(dataUrl, this.DEFAULT_OPTIONS);
    return result.dataUrl;
  }

  /**
   * Comprime para uso como fundo (qualidade média)
   */
  async compressForBackground(dataUrl: string): Promise<string> {
    const result = await this.compressDataUrl(dataUrl, this.BACKGROUND_OPTIONS);
    return result.dataUrl;
  }

  /**
   * Comprime para thumbnail (qualidade baixa, tamanho pequeno)
   */
  async compressForThumbnail(dataUrl: string): Promise<string> {
    const result = await this.compressDataUrl(dataUrl, this.THUMBNAIL_OPTIONS);
    return result.dataUrl;
  }

  /**
   * Comprime múltiplas imagens em paralelo
   */
  async compressMultiple(
    files: File[], 
    options?: CompressionOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const result = await this.compressFile(files[i], options);
      results.push(result);
      onProgress?.(i + 1, files.length);
    }
    
    return results;
  }

  /**
   * Verifica se uma imagem precisa de compressão
   */
  needsCompression(dataUrl: string, maxSizeKB: number = 500): boolean {
    const size = this.getBase64Size(dataUrl);
    return size > maxSizeKB * 1024;
  }

  /**
   * Obtém o tamanho de uma string base64 em bytes
   */
  getBase64Size(dataUrl: string): number {
    // Remover o prefixo data:image/...;base64,
    const base64 = dataUrl.split(',')[1] || dataUrl;
    // Cada caractere base64 representa 6 bits, então 4 chars = 3 bytes
    const padding = (base64.match(/=/g) || []).length;
    return Math.floor((base64.length * 3) / 4) - padding;
  }

  /**
   * Formata o tamanho em bytes para exibição
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ============== Métodos Privados ==============

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private calculateDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    // Se a imagem já é menor que os limites, não redimensionar
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    // Calcular proporção
    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = Math.floor(width / aspectRatio);
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = Math.floor(height * aspectRatio);
    }

    return { width, height };
  }

  private resizeAndCompress(
    img: HTMLImageElement, 
    width: number, 
    height: number, 
    quality: number
  ): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      
      // Usar melhor qualidade de interpolação
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Desenhar imagem redimensionada
      ctx.drawImage(img, 0, 0, width, height);

      // Converter para JPEG com qualidade especificada
      // Se a imagem original tem transparência, usar PNG
      const hasTransparency = this.checkTransparency(img);
      
      if (hasTransparency) {
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(canvas.toDataURL('image/jpeg', quality));
      }
    });
  }

  private checkTransparency(img: HTMLImageElement): boolean {
    // Criar um canvas pequeno para verificar transparência
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(img.naturalWidth, 100);
    canvas.height = Math.min(img.naturalHeight, 100);
    
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Verificar se algum pixel tem alpha < 255
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          return true;
        }
      }
    } catch (e) {
      // Se não conseguir ler os pixels (CORS), assumir sem transparência
      return false;
    }
    
    return false;
  }
}
