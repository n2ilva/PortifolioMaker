import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlideService } from '../../services/slide.service';
import { ImageElement, TextElement, AnimationType, SlideTransitionType } from '../../models/slide.model';

@Component({
  selector: 'app-presentation',
  imports: [CommonModule],
  templateUrl: './presentation.html',
  styleUrl: './presentation.css'
})
export class PresentationComponent {
  slideService = inject(SlideService);
  
  isOpen = false;
  currentSlideIndex = 0;
  showControls = true;
  private controlsTimeout: any;
  
  // Controle de animações
  private animationKey = 0; // Usado para forçar re-render de animações
  
  // Controle de reprodução automática
  isAutoPlaying = false;
  private autoPlayTimeout: any;
  timeRemaining = 0;
  private countdownInterval: any;
  
  // Controle de transição
  isTransitioning = false;
  transitionClass = '';

  open(): void {
    this.isOpen = true;
    this.currentSlideIndex = this.getCurrentSlideIndex();
    this.enterFullscreen();
    this.resetControlsTimeout();
    // Não dispara transição na abertura - só após play ou navegação manual
  }

  close(): void {
    this.isOpen = false;
    this.stopAutoPlay();
    this.exitFullscreen();
  }

  private getCurrentSlideIndex(): number {
    const slides = this.slideService.slides();
    const currentId = this.slideService.currentSlideId();
    const index = slides.findIndex(s => s.id === currentId);
    return index >= 0 ? index : 0;
  }

  get currentSlide() {
    return this.slideService.slides()[this.currentSlideIndex];
  }

  get totalSlides() {
    return this.slideService.slides().length;
  }

  // Obter duração do slide atual
  get currentSlideDuration(): number {
    return this.currentSlide?.duration || 5;
  }

  // Obter classe de transição do slide atual
  get currentTransitionClass(): string {
    if (!this.isTransitioning) return '';
    const transition = this.currentSlide?.transition;
    if (!transition || transition.type === 'none') return '';
    return `transition-${transition.type}`;
  }

  // Obter duração da transição
  get transitionDuration(): number {
    return this.currentSlide?.transition?.duration || 0.5;
  }

  // Disparar transição ao mudar de slide
  private triggerTransition(): void {
    const transition = this.currentSlide?.transition;
    if (!transition || transition.type === 'none') return;
    
    this.isTransitioning = true;
    this.transitionClass = `transition-${transition.type}`;
    
    // Remover a classe após a animação
    setTimeout(() => {
      this.isTransitioning = false;
      this.transitionClass = '';
    }, (transition.duration || 0.5) * 1000);
  }

  nextSlide(): void {
    if (this.currentSlideIndex < this.totalSlides - 1) {
      this.currentSlideIndex++;
      this.resetAnimations();
      this.resetControlsTimeout();
      this.triggerTransition();
      
      // Se autoplay está ativo, reiniciar timer
      if (this.isAutoPlaying) {
        this.scheduleNextSlide();
      }
    } else if (this.isAutoPlaying) {
      // Parar autoplay no fim
      this.stopAutoPlay();
    }
  }

  prevSlide(): void {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.resetAnimations();
      this.resetControlsTimeout();
      this.triggerTransition();
      
      // Se autoplay está ativo, reiniciar timer
      if (this.isAutoPlaying) {
        this.scheduleNextSlide();
      }
    }
  }

  goToSlide(index: number): void {
    if (index >= 0 && index < this.totalSlides) {
      this.currentSlideIndex = index;
      this.resetAnimations();
      this.resetControlsTimeout();
      this.triggerTransition();
      
      // Se autoplay está ativo, reiniciar timer
      if (this.isAutoPlaying) {
        this.scheduleNextSlide();
      }
    }
  }

  // Alternar reprodução automática
  toggleAutoPlay(): void {
    if (this.isAutoPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  // Iniciar reprodução automática
  startAutoPlay(): void {
    this.isAutoPlaying = true;
    this.scheduleNextSlide();
  }

  // Parar reprodução automática
  stopAutoPlay(): void {
    this.isAutoPlaying = false;
    this.timeRemaining = 0;
    
    if (this.autoPlayTimeout) {
      clearTimeout(this.autoPlayTimeout);
      this.autoPlayTimeout = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  // Agendar próximo slide
  private scheduleNextSlide(): void {
    // Limpar timers anteriores
    if (this.autoPlayTimeout) {
      clearTimeout(this.autoPlayTimeout);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    const duration = this.currentSlideDuration;
    this.timeRemaining = duration;
    
    // Countdown visual
    this.countdownInterval = setInterval(() => {
      this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    }, 1000);
    
    // Timer para avançar slide
    this.autoPlayTimeout = setTimeout(() => {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      this.nextSlide();
    }, duration * 1000);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        event.preventDefault();
        this.nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault();
        this.prevSlide();
        break;
      case 'Escape':
        this.close();
        break;
      case 'Home':
        this.goToSlide(0);
        break;
      case 'End':
        this.goToSlide(this.totalSlides - 1);
        break;
      case 'p':
      case 'P':
        // Tecla P para play/pause automático
        this.toggleAutoPlay();
        break;
    }
  }

  @HostListener('document:mousemove')
  onMouseMove(): void {
    if (this.isOpen) {
      this.showControls = true;
      this.resetControlsTimeout();
    }
  }

  private resetControlsTimeout(): void {
    clearTimeout(this.controlsTimeout);
    this.showControls = true;
    this.controlsTimeout = setTimeout(() => {
      this.showControls = false;
    }, 3000);
  }

  private enterFullscreen(): void {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
  }

  private exitFullscreen(): void {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  // Métodos auxiliares para renderização
  isImage(element: ImageElement | TextElement): element is ImageElement {
    return element.type === 'image';
  }

  isText(element: ImageElement | TextElement): element is TextElement {
    return element.type === 'text';
  }

  getElementStyle(element: ImageElement | TextElement): { [key: string]: string } {
    const isTextElement = element.type === 'text';
    
    const styles: { [key: string]: string } = {
      position: 'absolute',
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      'z-index': `${element.zIndex}`
    };

    // Texto tem tamanho automático baseado no conteúdo, imagem tem dimensões fixas
    if (isTextElement) {
      styles['width'] = 'auto';
      styles['height'] = 'auto';
      styles['max-width'] = `calc(100% - ${element.position.x}%)`;
      styles['white-space'] = 'nowrap';
    } else {
      styles['width'] = `${element.position.width}%`;
      styles['height'] = `${element.position.height}%`;
    }

    if (element.border?.radius) {
      styles['border-radius'] = `${element.border.radius}px`;
      styles['overflow'] = 'hidden';
    }

    // Opacity é armazenado como 0-1
    if (element.opacity !== undefined && element.opacity !== 1) {
      styles['opacity'] = `${element.opacity}`;
    }

    if (element.rotation) {
      styles['transform'] = `rotate(${element.rotation}deg)`;
    }

    return styles;
  }

  getTextStyle(element: TextElement): { [key: string]: string } {
    const styles: { [key: string]: string } = {
      'font-size': `${element.fontSize}px`,
      'font-family': element.fontFamily,
      'font-weight': element.fontWeight || 'normal',
      'color': element.color,
      'text-align': element.textAlign || 'left'
    };

    if (element.fontStyle) {
      styles['font-style'] = element.fontStyle;
    }

    if (element.backgroundColor && element.backgroundColor !== 'transparent') {
      styles['background-color'] = element.backgroundColor;
      styles['padding'] = '8px 12px';
    }

    if (element.lineHeight) {
      styles['line-height'] = `${element.lineHeight}`;
    }

    return styles;
  }

  getImageStyle(element: ImageElement): { [key: string]: string } {
    return {
      'width': '100%',
      'height': '100%',
      'object-fit': element.fit || 'cover'
    };
  }

  // ============== Métodos de Animação ==============
  
  getAnimationKey(): number {
    return this.animationKey;
  }

  // Verifica se é uma animação especial de texto
  isTextAnimation(element: TextElement): boolean {
    const textAnimations = ['typewriter', 'letterByLetter', 'wordByWord', 'highlight', 'glitch'];
    return element.animation?.type ? textAnimations.includes(element.animation.type) : false;
  }

  // Gera classes de animação para o elemento (exceto animações de texto especiais)
  getAnimationClasses(element: ImageElement | TextElement): string {
    const classes: string[] = [];
    
    if (element.animation && element.animation.type !== 'none') {
      // Animações de texto especiais são tratadas separadamente
      const textAnimations = ['typewriter', 'letterByLetter', 'wordByWord', 'highlight', 'glitch'];
      if (!textAnimations.includes(element.animation.type)) {
        classes.push('element-animated');
        classes.push(`animate-${element.animation.type}`);
        if (element.animation.repeat) {
          classes.push('animate-repeat');
        }
      }
    }
    
    return classes.join(' ');
  }

  // Quebra o texto em letras para animação letra por letra
  getLetters(text: string): string[] {
    return text.split('');
  }

  // Quebra o texto em palavras para animação palavra por palavra
  getWords(text: string): string[] {
    return text.split(' ');
  }

  // Calcula o delay para cada letra/palavra
  getCharDelay(index: number, element: TextElement): string {
    const baseDelay = element.animation?.delay || 0;
    const duration = element.animation?.duration || 1;
    const totalChars = element.content.length;
    const delayPerChar = duration / totalChars;
    return `${baseDelay + (index * delayPerChar)}s`;
  }

  getWordDelay(index: number, element: TextElement): string {
    const baseDelay = element.animation?.delay || 0;
    const duration = element.animation?.duration || 1;
    const words = element.content.split(' ');
    const delayPerWord = duration / words.length;
    return `${baseDelay + (index * delayPerWord)}s`;
  }

  // Gera estilos inline de animação
  getAnimationStyle(element: ImageElement | TextElement): { [key: string]: string } {
    const styles: { [key: string]: string } = {};
    
    if (element.animation && element.animation.type !== 'none') {
      styles['animation-duration'] = `${element.animation.duration}s`;
      styles['animation-delay'] = `${element.animation.delay}s`;
      styles['animation-timing-function'] = element.animation.easing;
    }
    
    return styles;
  }

  // Incrementa o key para resetar animações ao trocar slide
  private resetAnimations(): void {
    this.animationKey++;
  }
}
