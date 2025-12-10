import { Injectable, inject } from '@angular/core';
import { SlideService } from './slide.service';
import { Slide, ImageElement, TextElement, SlideTransitionType } from '../models/slide.model';
import html2canvas from 'html2canvas';

export interface VideoExportProgress {
  status: 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  currentSlide: number;
  totalSlides: number;
  progress: number; // 0-100
  message: string;
}

export interface VideoExportOptions {
  width: number;
  height: number;
  fps: number;
  quality: number; // 0-1
  filename: string;
}

@Injectable({
  providedIn: 'root'
})
export class VideoExportService {
  private slideService = inject(SlideService);
  
  private defaultOptions: VideoExportOptions = {
    width: 1920,
    height: 1080,
    fps: 30,
    quality: 0.92,
    filename: 'apresentacao'
  };

  async exportToVideo(
    options: Partial<VideoExportOptions> = {},
    onProgress?: (progress: VideoExportProgress) => void
  ): Promise<Blob | null> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const slides = this.slideService.slides();
    
    if (slides.length === 0) {
      onProgress?.({
        status: 'error',
        currentSlide: 0,
        totalSlides: 0,
        progress: 0,
        message: 'Nenhum slide para exportar'
      });
      return null;
    }

    try {
      // Verificar suporte a MediaRecorder
      if (!window.MediaRecorder) {
        throw new Error('Seu navegador não suporta gravação de vídeo');
      }

      onProgress?.({
        status: 'preparing',
        currentSlide: 0,
        totalSlides: slides.length,
        progress: 0,
        message: 'Preparando exportação...'
      });

      // Criar canvas para renderização
      const canvas = document.createElement('canvas');
      canvas.width = finalOptions.width;
      canvas.height = finalOptions.height;
      const ctx = canvas.getContext('2d')!;

      // Configurar stream e recorder
      const stream = canvas.captureStream(finalOptions.fps);
      
      // Tentar usar codec VP9, fallback para VP8
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Iniciar gravação
      mediaRecorder.start();

      // Pré-renderizar todas as imagens dos slides
      const slideImages: HTMLImageElement[] = [];
      for (let i = 0; i < slides.length; i++) {
        const slideImage = await this.renderSlideToImage(slides[i], finalOptions);
        slideImages.push(slideImage);
      }

      // Renderizar cada slide com transições
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const duration = slide.duration || 5;
        const transition = slide.transition;
        const transitionDuration = transition?.duration || 0.5;
        const transitionType = transition?.type || 'none';

        onProgress?.({
          status: 'rendering',
          currentSlide: i + 1,
          totalSlides: slides.length,
          progress: Math.round((i / slides.length) * 80),
          message: `Renderizando slide ${i + 1} de ${slides.length}...`
        });

        // Se há transição e não é o primeiro slide, renderizar a transição
        if (i > 0 && transitionType !== 'none') {
          const prevSlideImage = slideImages[i - 1];
          const currentSlideImage = slideImages[i];
          const transitionFrames = Math.ceil(transitionDuration * finalOptions.fps);
          
          for (let frame = 0; frame < transitionFrames; frame++) {
            const progress = frame / transitionFrames;
            this.renderTransitionFrame(
              ctx, 
              prevSlideImage, 
              currentSlideImage, 
              transitionType, 
              progress, 
              finalOptions
            );
            await new Promise(resolve => setTimeout(resolve, 1000 / finalOptions.fps));
          }
        }

        // Renderizar slide estático pelo tempo restante
        const staticDuration = duration - (i > 0 && transitionType !== 'none' ? transitionDuration : 0);
        const staticFrameCount = Math.max(1, Math.ceil(staticDuration * finalOptions.fps));
        
        for (let frame = 0; frame < staticFrameCount; frame++) {
          ctx.drawImage(slideImages[i], 0, 0, finalOptions.width, finalOptions.height);
          await new Promise(resolve => setTimeout(resolve, 1000 / finalOptions.fps));
        }
      }

      onProgress?.({
        status: 'encoding',
        currentSlide: slides.length,
        totalSlides: slides.length,
        progress: 90,
        message: 'Finalizando vídeo...'
      });

      // Parar gravação e aguardar
      return new Promise((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          
          onProgress?.({
            status: 'complete',
            currentSlide: slides.length,
            totalSlides: slides.length,
            progress: 100,
            message: 'Exportação concluída!'
          });
          
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          reject(new Error('Erro durante a gravação'));
        };

        mediaRecorder.stop();
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      onProgress?.({
        status: 'error',
        currentSlide: 0,
        totalSlides: slides.length,
        progress: 0,
        message: errorMessage
      });
      return null;
    }
  }

  private async renderSlideToImage(slide: Slide, options: VideoExportOptions): Promise<HTMLImageElement> {
    // Criar container temporário para renderização
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: -9999px;
      width: ${options.width}px;
      height: ${options.height}px;
      background-color: ${slide.backgroundColor};
      overflow: hidden;
    `;
    
    // Renderizar elementos do slide
    for (const element of slide.elements) {
      const elementDiv = this.createElementDiv(element, options);
      container.appendChild(elementDiv);
    }
    
    document.body.appendChild(container);
    
    try {
      // Usar html2canvas para capturar
      const canvas = await html2canvas(container, {
        width: options.width,
        height: options.height,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: slide.backgroundColor
      });
      
      // Converter para imagem
      const img = new Image();
      img.src = canvas.toDataURL('image/png', options.quality);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      return img;
    } finally {
      document.body.removeChild(container);
    }
  }

  private createElementDiv(element: ImageElement | TextElement, options: VideoExportOptions): HTMLDivElement {
    const div = document.createElement('div');
    
    // Calcular posição e tamanho em pixels
    const x = (element.position.x / 100) * options.width;
    const y = (element.position.y / 100) * options.height;
    const width = (element.position.width / 100) * options.width;
    const height = (element.position.height / 100) * options.height;
    
    div.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      height: ${height}px;
      z-index: ${element.zIndex};
      opacity: ${element.opacity ?? 1};
      ${element.rotation ? `transform: rotate(${element.rotation}deg);` : ''}
      ${element.border?.radius ? `border-radius: ${element.border.radius}px; overflow: hidden;` : ''}
    `;
    
    if (element.type === 'image') {
      const imgElement = element as ImageElement;
      const img = document.createElement('img');
      img.src = imgElement.src;
      img.alt = imgElement.alt || '';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: ${imgElement.fit || 'cover'};
      `;
      div.appendChild(img);
    } else {
      const textElement = element as TextElement;
      div.innerHTML = textElement.content;
      div.style.cssText += `
        font-size: ${textElement.fontSize}px;
        font-family: ${textElement.fontFamily};
        font-weight: ${textElement.fontWeight || 'normal'};
        font-style: ${textElement.fontStyle || 'normal'};
        color: ${textElement.color};
        text-align: ${textElement.textAlign || 'left'};
        line-height: ${textElement.lineHeight || 1.2};
        ${textElement.backgroundColor ? `background-color: ${textElement.backgroundColor};` : ''}
        display: flex;
        align-items: center;
        justify-content: ${textElement.textAlign === 'center' ? 'center' : textElement.textAlign === 'right' ? 'flex-end' : 'flex-start'};
      `;
    }
    
    return div;
  }

  downloadVideo(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Renderiza um frame de transição entre dois slides
   */
  private renderTransitionFrame(
    ctx: CanvasRenderingContext2D,
    prevImage: HTMLImageElement,
    nextImage: HTMLImageElement,
    transitionType: SlideTransitionType,
    progress: number, // 0 a 1
    options: VideoExportOptions
  ): void {
    const { width, height } = options;
    const easeProgress = this.easeInOutCubic(progress);

    // Limpar canvas
    ctx.clearRect(0, 0, width, height);

    switch (transitionType) {
      case 'fade':
        // Fade: crossfade entre slides
        ctx.globalAlpha = 1 - easeProgress;
        ctx.drawImage(prevImage, 0, 0, width, height);
        ctx.globalAlpha = easeProgress;
        ctx.drawImage(nextImage, 0, 0, width, height);
        ctx.globalAlpha = 1;
        break;

      case 'slideLeft':
        // Slide esquerda: novo slide entra da direita
        ctx.drawImage(prevImage, -width * easeProgress, 0, width, height);
        ctx.drawImage(nextImage, width * (1 - easeProgress), 0, width, height);
        break;

      case 'slideRight':
        // Slide direita: novo slide entra da esquerda
        ctx.drawImage(prevImage, width * easeProgress, 0, width, height);
        ctx.drawImage(nextImage, -width * (1 - easeProgress), 0, width, height);
        break;

      case 'slideUp':
        // Slide cima: novo slide entra de baixo
        ctx.drawImage(prevImage, 0, -height * easeProgress, width, height);
        ctx.drawImage(nextImage, 0, height * (1 - easeProgress), width, height);
        break;

      case 'slideDown':
        // Slide baixo: novo slide entra de cima
        ctx.drawImage(prevImage, 0, height * easeProgress, width, height);
        ctx.drawImage(nextImage, 0, -height * (1 - easeProgress), width, height);
        break;

      case 'zoomIn':
        // Zoom in: novo slide começa pequeno e cresce
        ctx.globalAlpha = 1 - easeProgress;
        ctx.drawImage(prevImage, 0, 0, width, height);
        ctx.globalAlpha = easeProgress;
        const scaleIn = 0.5 + (0.5 * easeProgress);
        const offsetXIn = (width - width * scaleIn) / 2;
        const offsetYIn = (height - height * scaleIn) / 2;
        ctx.drawImage(nextImage, offsetXIn, offsetYIn, width * scaleIn, height * scaleIn);
        ctx.globalAlpha = 1;
        break;

      case 'zoomOut':
        // Zoom out: slide anterior cresce e desaparece
        ctx.globalAlpha = easeProgress;
        ctx.drawImage(nextImage, 0, 0, width, height);
        ctx.globalAlpha = 1 - easeProgress;
        const scaleOut = 1 + (0.5 * easeProgress);
        const offsetXOut = (width - width * scaleOut) / 2;
        const offsetYOut = (height - height * scaleOut) / 2;
        ctx.drawImage(prevImage, offsetXOut, offsetYOut, width * scaleOut, height * scaleOut);
        ctx.globalAlpha = 1;
        break;

      case 'flip':
        // Flip horizontal simulado
        if (progress < 0.5) {
          const flipScale = 1 - (progress * 2);
          const flipOffset = (width - width * flipScale) / 2;
          ctx.drawImage(prevImage, flipOffset, 0, width * flipScale, height);
        } else {
          const flipScale = (progress - 0.5) * 2;
          const flipOffset = (width - width * flipScale) / 2;
          ctx.drawImage(nextImage, flipOffset, 0, width * flipScale, height);
        }
        break;

      case 'rotate':
        // Rotação com fade
        ctx.save();
        ctx.globalAlpha = 1 - easeProgress;
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI * easeProgress);
        ctx.scale(1 - easeProgress * 0.5, 1 - easeProgress * 0.5);
        ctx.drawImage(prevImage, -width / 2, -height / 2, width, height);
        ctx.restore();
        
        ctx.save();
        ctx.globalAlpha = easeProgress;
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI * (1 - easeProgress));
        ctx.scale(0.5 + easeProgress * 0.5, 0.5 + easeProgress * 0.5);
        ctx.drawImage(nextImage, -width / 2, -height / 2, width, height);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;

      case 'blur':
        // Blur simulado com crossfade (blur real não é possível em canvas simples)
        ctx.globalAlpha = 1 - easeProgress;
        ctx.drawImage(prevImage, 0, 0, width, height);
        ctx.globalAlpha = easeProgress;
        ctx.drawImage(nextImage, 0, 0, width, height);
        ctx.globalAlpha = 1;
        break;

      case 'dissolve':
        // Dissolve: crossfade com brilho
        ctx.globalAlpha = 1 - easeProgress;
        ctx.filter = `brightness(${1 + easeProgress})`;
        ctx.drawImage(prevImage, 0, 0, width, height);
        ctx.globalAlpha = easeProgress;
        ctx.filter = `brightness(${2 - easeProgress})`;
        ctx.drawImage(nextImage, 0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        break;

      default:
        // Sem transição: apenas mostrar o próximo
        ctx.drawImage(nextImage, 0, 0, width, height);
    }
  }

  /**
   * Função de easing para transições mais suaves
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
