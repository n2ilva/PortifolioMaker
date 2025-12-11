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
  hasStarted = false; // Controla se a apresentação já iniciou (após primeiro play ou navegação)
  
  // Controle de reprodução automática
  isAutoPlaying = false;
  private autoPlayTimeout: any;
  timeRemaining = 0;
  private countdownInterval: any;
  
  // Controle de transição
  isTransitioning = false;
  transitionClass = '';
  isNavigating = false; // Evita múltiplas navegações durante transição

  open(): void {
    this.isOpen = true;
    this.currentSlideIndex = this.getCurrentSlideIndex();
    this.hasStarted = false; // Resetar - animações só após play ou navegação
    this.enterFullscreen();
    this.resetControlsTimeout();
    // Não dispara transição na abertura - só após play ou navegação manual
  }

  close(): void {
    this.isOpen = false;
    this.hasStarted = false;
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
  private triggerTransition(callback?: () => void): void {
    const transition = this.currentSlide?.transition;
    if (!transition || transition.type === 'none') {
      // Sem transição, executar callback imediatamente
      if (callback) callback();
      return;
    }
    
    this.isTransitioning = true;
    this.transitionClass = `transition-${transition.type}`;
    
    // Aguardar a animação terminar antes de executar callback
    const duration = (transition.duration || 0.5) * 1000;
    setTimeout(() => {
      this.isTransitioning = false;
      this.transitionClass = '';
      if (callback) callback();
    }, duration);
  }

  // Navegar para o próximo slide com transição suave
  private navigateToSlide(newIndex: number): void {
    if (this.isNavigating) return; // Evita navegação durante transição
    
    const nextSlide = this.slideService.slides()[newIndex];
    const transition = nextSlide?.transition;
    const duration = (transition?.duration || 0.5) * 1000;
    
    // Se tem transição, aplicar animação de entrada no novo slide
    if (transition && transition.type !== 'none') {
      this.isNavigating = true;
      this.isTransitioning = true;
      
      // Mudar o slide imediatamente e aplicar animação de entrada
      this.currentSlideIndex = newIndex;
      this.resetAnimations();
      this.transitionClass = `transition-${transition.type}-enter`;
      
      // Após a duração completa, finalizar transição
      setTimeout(() => {
        this.isTransitioning = false;
        this.transitionClass = '';
        this.isNavigating = false;
      }, duration);
    } else {
      // Sem transição
      this.currentSlideIndex = newIndex;
      this.resetAnimations();
    }
  }

  nextSlide(): void {
    if (this.isNavigating) return;
    if (this.currentSlideIndex < this.totalSlides - 1) {
      this.hasStarted = true;
      this.navigateToSlide(this.currentSlideIndex + 1);
      this.resetControlsTimeout();
      
      // Se autoplay está ativo, parar e reiniciar (usuário interrompeu)
      if (this.isAutoPlaying) {
        this.stopAutoPlay();
      }
    } else if (this.isAutoPlaying) {
      // Parar autoplay no fim
      this.stopAutoPlay();
    }
  }

  prevSlide(): void {
    if (this.isNavigating) return;
    if (this.currentSlideIndex > 0) {
      this.hasStarted = true;
      this.navigateToSlide(this.currentSlideIndex - 1);
      this.resetControlsTimeout();
      
      // Se autoplay está ativo, parar (usuário interrompeu)
      if (this.isAutoPlaying) {
        this.stopAutoPlay();
      }
    }
  }

  goToSlide(index: number): void {
    if (this.isNavigating) return;
    if (index >= 0 && index < this.totalSlides && index !== this.currentSlideIndex) {
      this.hasStarted = true;
      this.navigateToSlide(index);
      this.resetControlsTimeout();
      
      // Se autoplay está ativo, parar (usuário interrompeu)
      if (this.isAutoPlaying) {
        this.stopAutoPlay();
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
    this.hasStarted = true; // Ativar animações ao dar play
    this.resetAnimations(); // Reiniciar animações do slide atual
    // Aplicar transição de entrada no primeiro slide
    const transition = this.currentSlide?.transition;
    if (transition && transition.type !== 'none') {
      this.isTransitioning = true;
      this.transitionClass = `transition-${transition.type}-enter`;
      setTimeout(() => {
        this.isTransitioning = false;
        this.transitionClass = '';
      }, (transition.duration || 0.5) * 1000);
    }
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
    
    // Considerar duração do slide + transição do próximo slide
    const slideDuration = this.currentSlideDuration;
    const nextIndex = this.currentSlideIndex + 1;
    const nextSlide = this.slideService.slides()[nextIndex];
    const transitionDuration = nextSlide?.transition?.duration || 0.5;
    
    // O tempo total é a duração do slide (a transição acontece durante a troca)
    const totalDuration = slideDuration;
    this.timeRemaining = Math.ceil(totalDuration);
    
    // Countdown visual
    this.countdownInterval = setInterval(() => {
      this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    }, 1000);
    
    // Timer para avançar slide (não chama scheduleNextSlide novamente aqui)
    this.autoPlayTimeout = setTimeout(() => {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      // Chama navegação diretamente sem agendar novamente
      this.advanceToNextSlide();
    }, totalDuration * 1000);
  }

  // Avançar para o próximo slide (chamado pelo autoplay)
  private advanceToNextSlide(): void {
    if (this.isNavigating) {
      // Se está navegando, tenta novamente após a transição
      setTimeout(() => this.advanceToNextSlide(), 100);
      return;
    }
    
    if (this.currentSlideIndex < this.totalSlides - 1) {
      this.navigateToSlide(this.currentSlideIndex + 1);
      
      // Aguarda a transição terminar antes de agendar o próximo
      const nextSlide = this.slideService.slides()[this.currentSlideIndex + 1];
      const transitionDuration = (nextSlide?.transition?.duration || 0.5) * 1000;
      
      setTimeout(() => {
        if (this.isAutoPlaying) {
          this.scheduleNextSlide();
        }
      }, transitionDuration);
    } else if (this.isAutoPlaying) {
      // Parar autoplay no fim
      this.stopAutoPlay();
    }
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

  // Retorna elementos com animação ordenados pela ordem
  private getOrderedAnimatedElements(): (ImageElement | TextElement)[] {
    if (!this.currentSlide) return [];
    
    return this.currentSlide.elements
      .filter(el => el.animation && el.animation.type !== 'none')
      .sort((a, b) => {
        const orderA = a.animation?.order || 1;
        const orderB = b.animation?.order || 1;
        return orderA - orderB;
      });
  }

  // Retorna a duração da transição do slide (animações começam após essa duração)
  private getSlideTransitionDelay(): number {
    const transition = this.currentSlide?.transition;
    if (!transition || transition.type === 'none') {
      return 0;
    }
    return transition.duration || 0.5;
  }

  // Calcula o delay acumulado para um elemento baseado no sequenciamento
  getCalculatedDelay(element: ImageElement | TextElement): number {
    if (!element.animation || element.animation.type === 'none') {
      return 0;
    }

    const trigger = element.animation.startTrigger || 'onClick';
    const extraDelay = element.animation.delay || 0;
    const order = element.animation.order || 1;
    
    // Delay base: a transição do slide acontece primeiro
    const slideTransitionDelay = this.getSlideTransitionDelay();

    // Ao clicar - usa o delay da transição do slide + delay configurado
    if (trigger === 'onClick') {
      return slideTransitionDelay + extraDelay;
    }

    // Com a anterior ou após a anterior - calcula baseado nos elementos anteriores
    const orderedElements = this.getOrderedAnimatedElements();
    let accumulatedDelay = slideTransitionDelay; // Começa após a transição do slide

    for (const el of orderedElements) {
      if (!el.animation) continue;
      
      const elOrder = el.animation.order || 1;
      const elTrigger = el.animation.startTrigger || 'onClick';
      const elDuration = el.animation.duration || 0.5;
      const elDelay = el.animation.delay || 0;

      // Se chegou no elemento atual, para
      if (el.id === element.id) {
        break;
      }

      // Se o elemento tem ordem menor, considerar seu delay
      if (elOrder < order) {
        if (trigger === 'afterPrevious') {
          // Após a anterior: acumula duração + delay do anterior
          accumulatedDelay = Math.max(accumulatedDelay, this.getCalculatedDelayForElement(el) + elDuration);
        } else if (trigger === 'withPrevious') {
          // Com a anterior: usa o mesmo delay do anterior da mesma ordem ou menor
          // Não acumula, apenas usa o delay base do grupo
        }
      } else if (elOrder === order && trigger === 'withPrevious') {
        // Mesmo grupo, com a anterior - pega o maior delay já calculado
        const elCalculatedDelay = this.getCalculatedDelayForElement(el);
        accumulatedDelay = Math.max(accumulatedDelay, elCalculatedDelay);
      }
    }

    return accumulatedDelay + extraDelay;
  }

  // Calcula delay para um elemento específico (helper recursivo com cache)
  // Retorna delay RELATIVO (sem contar transição do slide)
  private delayCache = new Map<string, number>();
  
  private getCalculatedDelayForElement(element: ImageElement | TextElement): number {
    if (!element.animation || element.animation.type === 'none') {
      return 0;
    }

    // Verifica cache
    const cacheKey = `${this.animationKey}-${element.id}`;
    if (this.delayCache.has(cacheKey)) {
      return this.delayCache.get(cacheKey)!;
    }

    const trigger = element.animation.startTrigger || 'onClick';
    const extraDelay = element.animation.delay || 0;
    const order = element.animation.order || 1;

    // Delay base da transição do slide
    const slideTransitionDelay = this.getSlideTransitionDelay();

    if (trigger === 'onClick') {
      const result = slideTransitionDelay + extraDelay;
      this.delayCache.set(cacheKey, result);
      return result;
    }

    const orderedElements = this.getOrderedAnimatedElements();
    let accumulatedDelay = slideTransitionDelay; // Começa após a transição do slide

    for (const el of orderedElements) {
      if (!el.animation || el.id === element.id) continue;
      
      const elOrder = el.animation.order || 1;
      const elDuration = el.animation.duration || 0.5;

      if (elOrder < order) {
        if (trigger === 'afterPrevious') {
          const elDelay = this.getCalculatedDelayForElement(el);
          accumulatedDelay = Math.max(accumulatedDelay, elDelay + elDuration);
        }
      }
    }

    const result = accumulatedDelay + extraDelay;
    this.delayCache.set(cacheKey, result);
    return result;
  }

  // Verifica se elemento deve estar visível (antes da animação = invisível)
  shouldElementBeVisible(element: ImageElement | TextElement): boolean {
    // Se não iniciou, mostra todos normalmente (para edição)
    if (!this.hasStarted) {
      return true;
    }
    
    // Se não tem animação, sempre visível
    if (!element.animation || element.animation.type === 'none') {
      return true;
    }

    // Durante a apresentação, elemento começa invisível e aparece com a animação
    // A visibilidade é controlada pelo CSS da animação (animation-fill-mode: both)
    return true; // O CSS cuida da visibilidade inicial
  }

  // Verifica se o elemento deve iniciar oculto (opacity 0 antes da animação)
  shouldStartHidden(element: ImageElement | TextElement): boolean {
    if (!this.hasStarted) {
      return false;
    }
    
    if (!element.animation || element.animation.type === 'none') {
      return false;
    }

    // Elementos com animação começam ocultos
    return true;
  }

  // Gera classes de animação para o elemento (exceto animações de texto especiais)
  getAnimationClasses(element: ImageElement | TextElement): string {
    const classes: string[] = [];
    
    // Só aplicar animações se a apresentação já iniciou
    if (!this.hasStarted) {
      return '';
    }
    
    if (element.animation && element.animation.type !== 'none') {
      // Animações de texto especiais são tratadas separadamente
      const textAnimations = ['typewriter', 'letterByLetter', 'wordByWord', 'highlight', 'glitch'];
      if (!textAnimations.includes(element.animation.type)) {
        classes.push('element-animated');
        classes.push('element-hidden-before-animation'); // Começa oculto
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
    const baseDelay = this.getCalculatedDelay(element);
    const duration = element.animation?.duration || 1;
    const totalChars = element.content.length;
    const delayPerChar = duration / totalChars;
    return `${baseDelay + (index * delayPerChar)}s`;
  }

  getWordDelay(index: number, element: TextElement): string {
    const baseDelay = this.getCalculatedDelay(element);
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
      styles['animation-delay'] = `${this.getCalculatedDelay(element)}s`;
      styles['animation-timing-function'] = element.animation.easing;
    }
    
    return styles;
  }

  // Incrementa o key para resetar animações ao trocar slide
  private resetAnimations(): void {
    this.animationKey++;
    this.delayCache.clear(); // Limpa cache de delays
  }
}
