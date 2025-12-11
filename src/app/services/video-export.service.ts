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

// Imagem pré-renderizada de um elemento
interface RenderedElement {
  element: ImageElement | TextElement;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  duration: number;
  animationType: string;
}

// Slide pré-renderizado
interface RenderedSlide {
  slide: Slide;
  backgroundColor: string;
  elements: RenderedElement[];
  transitionType: SlideTransitionType;
  transitionDuration: number;
  slideDuration: number;
  // Snapshot do slide completo para transições
  fullSnapshot?: HTMLImageElement;
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
      if (!window.MediaRecorder) {
        throw new Error('Seu navegador não suporta gravação de vídeo');
      }

      onProgress?.({
        status: 'preparing',
        currentSlide: 0,
        totalSlides: slides.length,
        progress: 0,
        message: 'Pré-renderizando elementos...'
      });

      // Criar canvas para renderização
      const canvas = document.createElement('canvas');
      canvas.width = finalOptions.width;
      canvas.height = finalOptions.height;
      const ctx = canvas.getContext('2d')!;

      // PRÉ-RENDERIZAR todos os slides e elementos (fase mais lenta, mas feita uma vez)
      const renderedSlides: RenderedSlide[] = [];
      for (let i = 0; i < slides.length; i++) {
        onProgress?.({
          status: 'preparing',
          currentSlide: i + 1,
          totalSlides: slides.length,
          progress: Math.round((i / slides.length) * 30),
          message: `Preparando slide ${i + 1} de ${slides.length}...`
        });
        
        const rendered = await this.preRenderSlide(slides[i], finalOptions);
        renderedSlides.push(rendered);
      }

      // Configurar stream e recorder
      const stream = canvas.captureStream(finalOptions.fps);
      
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.start();

      // RENDERIZAR frames (rápido, só desenha no canvas)
      for (let i = 0; i < renderedSlides.length; i++) {
        const slide = renderedSlides[i];
        const prevSlide = i > 0 ? renderedSlides[i - 1] : null;
        
        onProgress?.({
          status: 'rendering',
          currentSlide: i + 1,
          totalSlides: slides.length,
          progress: 30 + Math.round((i / slides.length) * 60),
          message: `Renderizando slide ${i + 1} de ${slides.length}...`
        });

        // Calcular duração total do slide
        const maxAnimationEnd = this.getMaxAnimationEnd(slide);
        const contentDuration = Math.max(slide.slideDuration - slide.transitionDuration, maxAnimationEnd);
        
        // Se não é o primeiro slide e tem transição
        if (prevSlide && slide.transitionType !== 'none') {
          const transitionFrames = Math.ceil(slide.transitionDuration * finalOptions.fps);
          
          for (let frame = 0; frame < transitionFrames; frame++) {
            const progress = frame / transitionFrames;
            this.renderTransitionFrame(ctx, prevSlide, slide, progress, finalOptions);
            await this.waitFrame(finalOptions.fps);
          }
        }

        // Renderizar frames do slide com animações
        const totalFrames = Math.ceil(contentDuration * finalOptions.fps);
        for (let frame = 0; frame < totalFrames; frame++) {
          const currentTime = slide.transitionDuration + (frame / finalOptions.fps);
          this.renderSlideFrame(ctx, slide, currentTime, finalOptions);
          await this.waitFrame(finalOptions.fps);
        }
      }

      onProgress?.({
        status: 'encoding',
        currentSlide: slides.length,
        totalSlides: slides.length,
        progress: 90,
        message: 'Finalizando vídeo...'
      });

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

        mediaRecorder.onerror = () => {
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

  /**
   * Pré-renderiza um slide e seus elementos como imagens
   */
  private async preRenderSlide(slide: Slide, options: VideoExportOptions): Promise<RenderedSlide> {
    const transitionDuration = slide.transition?.duration || 0.5;
    const elements: RenderedElement[] = [];
    
    // Ordenar elementos por ordem de animação
    const sortedElements = [...slide.elements].sort((a, b) => {
      const orderA = a.animation?.order || 1;
      const orderB = b.animation?.order || 1;
      return orderA - orderB;
    });

    // Calcular timeline de animações
    let lastEndTime = transitionDuration;
    
    for (const element of sortedElements) {
      const animation = element.animation;
      const trigger = animation?.startTrigger || 'onClick';
      const extraDelay = animation?.delay || 0;
      const duration = animation?.duration || 0.5;
      const animationType = animation?.type || 'none';
      
      let startTime = transitionDuration;
      
      if (animationType !== 'none') {
        if (trigger === 'onClick') {
          startTime = transitionDuration + extraDelay;
        } else if (trigger === 'withPrevious') {
          // Mesmo tempo que o anterior
          const prevAnimated = elements.filter(e => e.animationType !== 'none');
          if (prevAnimated.length > 0) {
            startTime = prevAnimated[prevAnimated.length - 1].startTime + extraDelay;
          } else {
            startTime = transitionDuration + extraDelay;
          }
        } else if (trigger === 'afterPrevious') {
          startTime = lastEndTime + extraDelay;
        }
        
        lastEndTime = Math.max(lastEndTime, startTime + duration);
      } else {
        startTime = 0; // Elementos sem animação aparecem imediatamente
      }

      // Renderizar elemento como imagem
      const elementImage = await this.renderElementToImage(element, options);
      
      elements.push({
        element,
        image: elementImage,
        x: (element.position.x / 100) * options.width,
        y: (element.position.y / 100) * options.height,
        width: (element.position.width / 100) * options.width,
        height: (element.position.height / 100) * options.height,
        startTime,
        duration,
        animationType
      });
    }

    // Criar snapshot completo para transições
    const fullSnapshot = await this.createFullSlideSnapshot(slide, options);

    return {
      slide,
      backgroundColor: slide.backgroundColor,
      elements,
      transitionType: slide.transition?.type || 'none',
      transitionDuration,
      slideDuration: slide.duration || 5,
      fullSnapshot
    };
  }

  /**
   * Cria um snapshot completo do slide (todos elementos visíveis)
   */
  private async createFullSlideSnapshot(slide: Slide, options: VideoExportOptions): Promise<HTMLImageElement> {
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

    // Adicionar todos os elementos
    for (const element of slide.elements) {
      const elDiv = await this.createElementDivSimple(element, options);
      container.appendChild(elDiv);
    }

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        width: options.width,
        height: options.height,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: slide.backgroundColor
      });

      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      return img;
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Cria div simples de elemento (para snapshot)
   */
  private async createElementDivSimple(element: ImageElement | TextElement, options: VideoExportOptions): Promise<HTMLDivElement> {
    const div = document.createElement('div');
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
      opacity: ${element.opacity ?? 1};
      transform: rotate(${element.rotation || 0}deg);
      overflow: hidden;
      ${element.border?.radius ? `border-radius: ${element.border.radius}px;` : ''}
    `;

    if (element.type === 'image') {
      const imgElement = element as ImageElement;
      const img = document.createElement('img');
      img.src = imgElement.src;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: ${imgElement.fit || 'cover'};
      `;
      div.appendChild(img);
      
      await new Promise((resolve) => {
        if (img.complete) resolve(null);
        else img.onload = () => resolve(null);
      });
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

  /**
   * Renderiza um único elemento como imagem
   */
  private async renderElementToImage(element: ImageElement | TextElement, options: VideoExportOptions): Promise<HTMLImageElement> {
    const width = (element.position.width / 100) * options.width;
    const height = (element.position.height / 100) * options.height;

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: -9999px;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      ${element.border?.radius ? `border-radius: ${element.border.radius}px;` : ''}
    `;

    if (element.type === 'image') {
      const imgElement = element as ImageElement;
      const img = document.createElement('img');
      img.src = imgElement.src;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: ${imgElement.fit || 'cover'};
      `;
      container.appendChild(img);
      
      // Aguardar imagem carregar
      await new Promise((resolve) => {
        if (img.complete) resolve(null);
        else img.onload = () => resolve(null);
      });
    } else {
      const textElement = element as TextElement;
      container.innerHTML = textElement.content;
      container.style.cssText += `
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

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        width: Math.ceil(width),
        height: Math.ceil(height),
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      });

      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      return img;
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Renderiza um frame do slide (rápido, só canvas)
   */
  private renderSlideFrame(
    ctx: CanvasRenderingContext2D,
    slide: RenderedSlide,
    currentTime: number,
    options: VideoExportOptions
  ): void {
    const { width, height } = options;

    // Limpar e desenhar fundo
    ctx.fillStyle = slide.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Desenhar elementos
    for (const el of slide.elements) {
      let opacity = 1;
      let translateX = 0;
      let translateY = 0;
      let scale = 1;
      let rotation = 0;
      let shouldDraw = true;

      if (el.animationType !== 'none') {
        if (currentTime < el.startTime) {
          // Antes da animação - invisível
          shouldDraw = false;
        } else if (currentTime < el.startTime + el.duration) {
          // Durante a animação
          const progress = (currentTime - el.startTime) / el.duration;
          const ease = this.easeOutCubic(progress);
          
          ({ opacity, translateX, translateY, scale, rotation } = 
            this.getAnimationState(el.animationType, ease, el.width, el.height));
        }
        // Após a animação - valores padrão (visível, estático)
      }

      if (shouldDraw) {
        ctx.save();
        
        // Aplicar transformações
        const centerX = el.x + el.width / 2;
        const centerY = el.y + el.height / 2;
        
        ctx.globalAlpha = opacity * (el.element.opacity ?? 1);
        ctx.translate(centerX + translateX, centerY + translateY);
        ctx.rotate((rotation + (el.element.rotation || 0)) * Math.PI / 180);
        ctx.scale(scale, scale);
        
        // Desenhar imagem centrada
        ctx.drawImage(el.image, -el.width / 2, -el.height / 2, el.width, el.height);
        
        ctx.restore();
      }
    }
  }

  /**
   * Calcula o estado da animação baseado no tipo e progresso
   */
  private getAnimationState(type: string, progress: number, width: number, height: number): {
    opacity: number;
    translateX: number;
    translateY: number;
    scale: number;
    rotation: number;
  } {
    let opacity = 1;
    let translateX = 0;
    let translateY = 0;
    let scale = 1;
    let rotation = 0;

    switch (type) {
      case 'fadeIn':
        opacity = progress;
        break;
      case 'fadeInUp':
        opacity = progress;
        translateY = (1 - progress) * 50;
        break;
      case 'fadeInDown':
        opacity = progress;
        translateY = (1 - progress) * -50;
        break;
      case 'fadeInLeft':
        opacity = progress;
        translateX = (1 - progress) * -50;
        break;
      case 'fadeInRight':
        opacity = progress;
        translateX = (1 - progress) * 50;
        break;
      case 'slideInUp':
        opacity = progress;
        translateY = (1 - progress) * height;
        break;
      case 'slideInDown':
        opacity = progress;
        translateY = (1 - progress) * -height;
        break;
      case 'slideInLeft':
        opacity = progress;
        translateX = (1 - progress) * -width;
        break;
      case 'slideInRight':
        opacity = progress;
        translateX = (1 - progress) * width;
        break;
      case 'zoomIn':
        opacity = progress;
        scale = 0.3 + (progress * 0.7);
        break;
      case 'zoomOut':
        opacity = progress;
        scale = 1.5 - (progress * 0.5);
        break;
      case 'bounceIn':
        opacity = progress;
        if (progress < 0.6) {
          scale = progress * 1.8;
        } else if (progress < 0.8) {
          scale = 1.1 - ((progress - 0.6) * 0.5);
        } else {
          scale = 0.9 + ((progress - 0.8) * 0.5);
        }
        break;
      case 'rotateIn':
        opacity = progress;
        scale = 0.3 + (progress * 0.7);
        rotation = (1 - progress) * -180;
        break;
      case 'flipInX':
      case 'flipInY':
        opacity = progress;
        scale = progress < 0.5 ? progress * 2 : 1;
        break;
      case 'pulse':
      case 'shake':
      case 'swing':
        // Estas aparecem imediatamente
        opacity = 1;
        break;
      default:
        opacity = progress;
    }

    return { opacity, translateX, translateY, scale, rotation };
  }

  /**
   * Renderiza frame de transição entre slides
   */
  private renderTransitionFrame(
    ctx: CanvasRenderingContext2D,
    prevSlide: RenderedSlide,
    nextSlide: RenderedSlide,
    progress: number,
    options: VideoExportOptions
  ): void {
    const { width, height } = options;
    const ease = this.easeInOutCubic(progress);

    // Usar snapshots pré-renderizados
    const prevImage = prevSlide.fullSnapshot;
    const nextBgCanvas = document.createElement('canvas');
    nextBgCanvas.width = width;
    nextBgCanvas.height = height;
    const nextCtx = nextBgCanvas.getContext('2d')!;
    nextCtx.fillStyle = nextSlide.backgroundColor;
    nextCtx.fillRect(0, 0, width, height);

    ctx.clearRect(0, 0, width, height);

    switch (nextSlide.transitionType) {
      case 'fade':
        if (prevImage) {
          ctx.globalAlpha = 1 - ease;
          ctx.drawImage(prevImage, 0, 0);
        }
        ctx.globalAlpha = ease;
        ctx.drawImage(nextBgCanvas, 0, 0);
        ctx.globalAlpha = 1;
        break;

      case 'slideLeft':
        if (prevImage) {
          ctx.drawImage(prevImage, -width * ease, 0);
        }
        ctx.drawImage(nextBgCanvas, width * (1 - ease), 0);
        break;

      case 'slideRight':
        if (prevImage) {
          ctx.drawImage(prevImage, width * ease, 0);
        }
        ctx.drawImage(nextBgCanvas, -width * (1 - ease), 0);
        break;

      case 'slideUp':
        if (prevImage) {
          ctx.drawImage(prevImage, 0, -height * ease);
        }
        ctx.drawImage(nextBgCanvas, 0, height * (1 - ease));
        break;

      case 'slideDown':
        if (prevImage) {
          ctx.drawImage(prevImage, 0, height * ease);
        }
        ctx.drawImage(nextBgCanvas, 0, -height * (1 - ease));
        break;

      case 'zoomIn':
        if (prevImage) {
          ctx.globalAlpha = 1 - ease;
          ctx.drawImage(prevImage, 0, 0);
        }
        ctx.globalAlpha = ease;
        const scaleIn = 0.5 + (0.5 * ease);
        const offsetXIn = (width - width * scaleIn) / 2;
        const offsetYIn = (height - height * scaleIn) / 2;
        ctx.drawImage(nextBgCanvas, offsetXIn, offsetYIn, width * scaleIn, height * scaleIn);
        ctx.globalAlpha = 1;
        break;

      case 'zoomOut':
        ctx.globalAlpha = ease;
        ctx.drawImage(nextBgCanvas, 0, 0);
        if (prevImage) {
          ctx.globalAlpha = 1 - ease;
          const scaleOut = 1 + (0.5 * ease);
          const offsetXOut = (width - width * scaleOut) / 2;
          const offsetYOut = (height - height * scaleOut) / 2;
          ctx.drawImage(prevImage, offsetXOut, offsetYOut, width * scaleOut, height * scaleOut);
        }
        ctx.globalAlpha = 1;
        break;

      default:
        ctx.drawImage(nextBgCanvas, 0, 0);
    }
  }

  /**
   * Retorna o tempo máximo de fim das animações
   */
  private getMaxAnimationEnd(slide: RenderedSlide): number {
    let max = 0;
    for (const el of slide.elements) {
      if (el.animationType !== 'none') {
        const end = el.startTime + el.duration;
        if (end > max) max = end;
      }
    }
    return max;
  }

  private waitFrame(fps: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 1000 / fps));
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
}
