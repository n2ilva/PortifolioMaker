import { Component, inject, ElementRef, ViewChild, HostListener, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlideService } from '../../services/slide.service';
import { ImageElement, TextElement, ElementBorderStyle, LayoutGridGuide, AnimationType } from '../../models/slide.model';

// Proporções padrão do mercado fotográfico
interface AspectRatioInfo {
  name: string;
  ratio: number;
  description: string;
  icon: string;
}

const STANDARD_ASPECT_RATIOS: AspectRatioInfo[] = [
  { name: '1:1', ratio: 1, description: 'Quadrado', icon: 'crop_square' },
  { name: '4:5', ratio: 0.8, description: 'Instagram Retrato', icon: 'smartphone' },
  { name: '2:3', ratio: 0.667, description: 'Foto 10x15', icon: 'image' },
  { name: '3:4', ratio: 0.75, description: 'Foto Clássica', icon: 'photo_camera' },
  { name: '3:2', ratio: 1.5, description: 'DSLR / 35mm', icon: 'camera_alt' },
  { name: '4:3', ratio: 1.333, description: 'Monitor / TV', icon: 'desktop_windows' },
  { name: '16:9', ratio: 1.778, description: 'Widescreen / HD', icon: 'tv' },
  { name: '21:9', ratio: 2.333, description: 'Ultrawide / Cinema', icon: 'movie' },
  { name: '9:16', ratio: 0.5625, description: 'Stories / Reels', icon: 'phone_android' },
  { name: '5:4', ratio: 1.25, description: 'Foto Grande Formato', icon: 'photo_library' },
  { name: 'A4', ratio: 1.414, description: 'Papel A4', icon: 'description' },
];

@Component({
  selector: 'app-slide-canvas',
  imports: [CommonModule, FormsModule],
  templateUrl: './slide-canvas.html',
  styleUrl: './slide-canvas.css'
})
export class SlideCanvas implements OnInit, OnDestroy {
  slideService = inject(SlideService);
  private cdr = inject(ChangeDetectorRef);
  
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;
  
  // Estado do drag
  private isDragging = false;
  private isResizing = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private elementStartX = 0;
  private elementStartY = 0;
  private elementStartWidth = 0;
  private elementStartHeight = 0;
  private resizeHandle = '';
  private elementAspectRatio = 1; // Para manter proporção ao redimensionar
  private resizingElementType: 'image' | 'text' | null = null;

  // Hover menu
  hoveredElementId: string | null = null;
  showHoverMenu = false;
  hoverMenuPosition = { x: 0, y: 0 };

  // Valores para o menu de borda
  borderRadiusValue = 0;
  shadowEnabled = false;

  // Edição de texto
  editingTextId: string | null = null;

  // Proporção atual detectada
  currentAspectRatio: AspectRatioInfo | null = null;

  onElementClick(event: MouseEvent, element: ImageElement | TextElement): void {
    event.stopPropagation();
    
    // Ctrl+clique para duplicar o elemento
    if (event.ctrlKey || event.metaKey) {
      this.slideService.duplicateElement(element.id);
      return;
    }
    
    this.slideService.selectElement(element.id);
  }

  onCanvasClick(): void {
    this.slideService.selectElement(null);
    this.editingTextId = null;
    this.hideHoverMenu();
  }

  // Controles de zoom
  onZoomIn(): void {
    const currentZoom = this.slideService.zoom();
    if (currentZoom < 200) {
      this.slideService.setZoom(currentZoom + 10);
    }
  }

  onZoomOut(): void {
    const currentZoom = this.slideService.zoom();
    if (currentZoom > 10) {
      this.slideService.setZoom(currentZoom - 10);
    }
  }

  // Double click para editar texto
  onTextDoubleClick(event: MouseEvent, element: ImageElement | TextElement): void {
    event.stopPropagation();
    event.preventDefault();
    this.editingTextId = element.id;
    this.slideService.selectElement(element.id);
    
    // Focar no elemento após um pequeno delay
    setTimeout(() => {
      const target = event.target as HTMLElement;
      target.focus();
      // Selecionar todo o texto
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 10);
  }

  // MouseDown no texto - permitir drag quando não está editando
  onTextMouseDown(event: MouseEvent, element: ImageElement | TextElement): void {
    if (this.editingTextId === element.id) {
      // Se está editando, não fazer drag
      event.stopPropagation();
    }
    // Se não está editando, deixa o evento propagar para o drag do elemento pai
  }

  // Quando sai do foco do texto - salvar o conteúdo
  onTextBlur(event: FocusEvent, element: TextElement): void {
    const target = event.target as HTMLDivElement;
    const newContent = target.innerText;
    
    // Atualizar o conteúdo no serviço
    if (newContent !== element.content) {
      this.slideService.updateElement(element.id, {
        content: newContent
      });
    }
    
    this.editingTextId = null;
  }

  onElementMouseEnter(event: MouseEvent, element: ImageElement | TextElement): void {
    this.hoveredElementId = element.id;
    this.slideService.setHoveredElement(element.id);
    
    // Atualizar valores do menu baseado no elemento
    this.borderRadiusValue = element.border?.radius || 0;
    this.shadowEnabled = element.shadow?.enabled || false;
    
    // Detectar proporção do elemento
    this.currentAspectRatio = this.detectAspectRatio(element);
  }

  onElementMouseLeave(event: MouseEvent, element: ImageElement | TextElement): void {
    // Não esconder se o mouse foi para o menu ou badge
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('.hover-menu') || relatedTarget?.closest('.aspect-ratio-badge')) {
      return;
    }
    
    // Pequeno delay para permitir que o mouse chegue ao menu
    setTimeout(() => {
      // Verificar se o mouse está sobre o menu
      const hoverMenu = document.querySelector('.hover-menu:hover');
      const aspectBadge = document.querySelector('.aspect-ratio-badge:hover');
      if (!hoverMenu && !aspectBadge) {
        // Só esconde se o elemento ainda é o mesmo (não mudou para outro)
        if (this.hoveredElementId === element.id) {
          this.hideHoverMenu();
        }
      }
    }, 100);
  }

  onHoverMenuMouseLeave(event: MouseEvent): void {
    // Verificar se o mouse voltou para o elemento
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('.element')) {
      return;
    }
    this.hideHoverMenu();
  }

  hideHoverMenu(): void {
    this.hoveredElementId = null;
    this.slideService.setHoveredElement(null);
    this.currentAspectRatio = null;
  }

  // Verifica se o arredondamento está no máximo (circular)
  isFullyRounded(): boolean {
    return this.borderRadiusValue >= 200; // Consideramos circular a partir de 200px
  }

  // Proporção do canvas (960x540 = 16:9)
  private canvasAspectRatio = 960 / 540; // 1.7778

  // Detectar proporção padrão do elemento
  detectAspectRatio(element: ImageElement | TextElement): AspectRatioInfo | null {
    const width = element.position.width;
    const height = element.position.height;
    
    if (width <= 0 || height <= 0) return null;
    
    // Calcula a proporção visual real (compensando a proporção do canvas)
    // Como as porcentagens são relativas ao canvas 16:9, precisamos multiplicar
    const visualRatio = (width / height) * this.canvasAspectRatio;
    const tolerance = 0.08; // 8% de tolerância
    
    for (const aspectRatio of STANDARD_ASPECT_RATIOS) {
      if (Math.abs(visualRatio - aspectRatio.ratio) <= tolerance * aspectRatio.ratio) {
        return aspectRatio;
      }
    }
    
    return null;
  }

  // Obter informação da proporção atual para exibição
  getAspectRatioInfo(): AspectRatioInfo | null {
    return this.currentAspectRatio;
  }

  // Verificar se tem uma proporção padrão detectada
  hasStandardAspectRatio(): boolean {
    return this.currentAspectRatio !== null;
  }

  // Atualizar proporção durante redimensionamento
  updateAspectRatioDetection(element: ImageElement | TextElement): void {
    this.currentAspectRatio = this.detectAspectRatio(element);
  }

  // Atualizar borda arredondada
  onBorderRadiusChange(element: ImageElement | TextElement): void {
    this.slideService.updateElementBorder(element.id, { radius: this.borderRadiusValue });
  }

  // Toggle sombra
  toggleShadow(element: ImageElement | TextElement): void {
    this.shadowEnabled = !this.shadowEnabled;
    this.slideService.updateElementShadow(element.id, { enabled: this.shadowEnabled });
  }

  // Presets de borda
  setBorderRadius(element: ImageElement | TextElement, value: number): void {
    this.borderRadiusValue = value;
    this.slideService.updateElementBorder(element.id, { radius: value });
  }

  onMouseDown(event: MouseEvent, element: ImageElement | TextElement, handle?: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.slideService.selectElement(element.id);
    
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.elementStartX = element.position.x;
    this.elementStartY = element.position.y;
    this.elementStartWidth = element.position.width;
    this.elementStartHeight = element.position.height;
    
    // Calcular aspect ratio para manter proporção (baseado em pixels reais)
    const widthPx = (element.position.width / 100) * rect.width;
    const heightPx = (element.position.height / 100) * rect.height;
    this.elementAspectRatio = widthPx / heightPx;
    this.resizingElementType = element.type;

    if (handle) {
      this.isResizing = true;
      this.resizeHandle = handle;
    } else {
      this.isDragging = true;
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging && !this.isResizing) return;
    
    const elementId = this.slideService.selectedElementId();
    if (!elementId) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    const deltaX = ((event.clientX - this.dragStartX) / rect.width) * 100;
    const deltaY = ((event.clientY - this.dragStartY) / rect.height) * 100;

    if (this.isDragging) {
      const newX = Math.max(0, Math.min(100 - this.elementStartWidth, this.elementStartX + deltaX));
      const newY = Math.max(0, Math.min(100 - this.elementStartHeight, this.elementStartY + deltaY));
      
      // Calcular linhas guia e snap
      const newPosition = {
        x: newX,
        y: newY,
        width: this.elementStartWidth,
        height: this.elementStartHeight
      };
      
      const { snappedPosition } = this.slideService.calculateAlignmentGuides(elementId, newPosition);
      
      this.slideService.updateElementPosition(elementId, {
        x: snappedPosition.x,
        y: snappedPosition.y
      });
    } else if (this.isResizing) {
      let newWidth = this.elementStartWidth;
      let newHeight = this.elementStartHeight;
      let newX = this.elementStartX;
      let newY = this.elementStartY;

      const canvas = this.canvasRef.nativeElement;
      const canvasRect = canvas.getBoundingClientRect();
      const canvasAspect = canvasRect.width / canvasRect.height;

      // Para imagens, manter proporção ao redimensionar pelos cantos
      const isCornerResize = (this.resizeHandle.includes('n') || this.resizeHandle.includes('s')) &&
                             (this.resizeHandle.includes('e') || this.resizeHandle.includes('w'));
      const keepAspectRatio = this.resizingElementType === 'image';

      if (keepAspectRatio && isCornerResize) {
        // Redimensionar mantendo proporção
        const deltaMax = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY * canvasAspect;
        
        if (this.resizeHandle === 'se') {
          newWidth = Math.max(5, this.elementStartWidth + deltaMax);
          newHeight = (newWidth / this.elementAspectRatio) * canvasAspect;
        } else if (this.resizeHandle === 'sw') {
          newWidth = Math.max(5, this.elementStartWidth - deltaMax);
          newHeight = (newWidth / this.elementAspectRatio) * canvasAspect;
          newX = this.elementStartX + (this.elementStartWidth - newWidth);
        } else if (this.resizeHandle === 'ne') {
          newWidth = Math.max(5, this.elementStartWidth + deltaMax);
          newHeight = (newWidth / this.elementAspectRatio) * canvasAspect;
          newY = this.elementStartY + (this.elementStartHeight - newHeight);
        } else if (this.resizeHandle === 'nw') {
          newWidth = Math.max(5, this.elementStartWidth - deltaMax);
          newHeight = (newWidth / this.elementAspectRatio) * canvasAspect;
          newX = this.elementStartX + (this.elementStartWidth - newWidth);
          newY = this.elementStartY + (this.elementStartHeight - newHeight);
        }
      } else {
        // Redimensionamento livre (bordas ou texto)
        if (this.resizeHandle.includes('e')) {
          newWidth = Math.max(5, this.elementStartWidth + deltaX);
        }
        if (this.resizeHandle.includes('w')) {
          newWidth = Math.max(5, this.elementStartWidth - deltaX);
          newX = this.elementStartX + deltaX;
        }
        if (this.resizeHandle.includes('s')) {
          newHeight = Math.max(5, this.elementStartHeight + deltaY);
        }
        if (this.resizeHandle.includes('n')) {
          newHeight = Math.max(5, this.elementStartHeight - deltaY);
          newY = this.elementStartY + deltaY;
        }
      }

      // Garantir valores mínimos
      newWidth = Math.max(5, newWidth);
      newHeight = Math.max(5, newHeight);

      this.slideService.updateElementPosition(elementId, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });

      // Atualizar detecção de proporção durante redimensionamento
      const element = this.slideService.selectedElement();
      if (element) {
        // Criar objeto temporário com novas dimensões para detectar
        const tempElement = {
          ...element,
          position: { ...element.position, width: newWidth, height: newHeight }
        };
        this.currentAspectRatio = this.detectAspectRatio(tempElement);
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = '';
    this.slideService.clearAlignmentGuides();
  }

  // Controles de teclado
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const selectedId = this.slideService.selectedElementId();
    
    // Não processar se estiver editando texto
    if (this.editingTextId) return;
    
    // Não processar se o foco estiver em um input ou textarea
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.getAttribute('contenteditable') === 'true')) {
      return;
    }
    
    if (!selectedId) return;
    
    // Quantidade de movimento (Shift para movimento maior)
    const moveAmount = event.shiftKey ? 5 : 1;
    
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.slideService.deleteElement(selectedId);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.slideService.moveElement(selectedId, 'up', moveAmount);
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        this.slideService.moveElement(selectedId, 'down', moveAmount);
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        this.slideService.moveElement(selectedId, 'left', moveAmount);
        break;
        
      case 'ArrowRight':
        event.preventDefault();
        this.slideService.moveElement(selectedId, 'right', moveAmount);
        break;
        
      case 'd':
      case 'D':
        // Ctrl+D para duplicar
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.slideService.duplicateElement(selectedId);
        }
        break;
    }
  }

  getElementStyle(element: ImageElement | TextElement): { [key: string]: string } {
    const isTextElement = element.type === 'text';
    
    const styles: { [key: string]: string } = {
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      'z-index': `${element.zIndex}`
    };

    // Texto tem tamanho automático baseado no conteúdo, imagem tem dimensões fixas
    if (isTextElement) {
      styles['width'] = 'auto';
      styles['height'] = 'auto';
      styles['max-width'] = `calc(100% - ${element.position.x}%)`; // Não ultrapassar o slide
      styles['white-space'] = 'nowrap'; // Texto em uma linha para tamanho exato
    } else {
      styles['width'] = `${element.position.width}%`;
      styles['height'] = `${element.position.height}%`;
    }

    // Aplicar borda arredondada no container
    if (element.border?.radius) {
      styles['border-radius'] = `${element.border.radius}px`;
      styles['overflow'] = 'hidden';
    }

    // Aplicar opacidade
    if (element.opacity !== undefined && element.opacity !== 1) {
      styles['opacity'] = `${element.opacity}`;
    }

    // Aplicar rotação
    if (element.rotation) {
      styles['transform'] = `rotate(${element.rotation}deg)`;
    }

    // Aplicar sombra
    if (element.shadow?.enabled) {
      const s = element.shadow;
      styles['box-shadow'] = `${s.x}px ${s.y}px ${s.blur}px ${s.color}`;
    }

    return styles;
  }

  getImageStyle(element: ImageElement): { [key: string]: string } {
    // Usar o fit definido no elemento (padrão: cover para preencher sem distorcer)
    const styles: { [key: string]: string } = {
      'object-fit': element.fit || 'cover',
      'width': '100%',
      'height': '100%'
    };

    // Aplicar borda arredondada na imagem também
    if (element.border?.radius) {
      styles['border-radius'] = `${element.border.radius}px`;
    }

    return styles;
  }

  getTextStyle(element: TextElement): { [key: string]: string } {
    const styles: { [key: string]: string } = {
      'font-size': `${element.fontSize}px`,
      'font-family': element.fontFamily,
      'font-weight': element.fontWeight,
      'color': element.color,
      'text-align': element.textAlign,
      'background-color': element.backgroundColor || 'transparent'
    };

    if (element.fontStyle) {
      styles['font-style'] = element.fontStyle;
    }

    if (element.lineHeight) {
      styles['line-height'] = `${element.lineHeight}`;
    }

    return styles;
  }

  isImage(element: ImageElement | TextElement): element is ImageElement {
    return element.type === 'image';
  }

  isText(element: ImageElement | TextElement): element is TextElement {
    return element.type === 'text';
  }

  // Verifica se é uma imagem de fundo (não deve ter opções de edição)
  isBackgroundImage(element: ImageElement | TextElement): boolean {
    return element.metadata?.['backgroundDecor'] === true;
  }

  asImage(element: ImageElement | TextElement): ImageElement {
    return element as ImageElement;
  }

  asText(element: ImageElement | TextElement): TextElement {
    return element as TextElement;
  }

  // Obter guias de grade do layout atual
  getLayoutGridGuides(layoutId?: string): LayoutGridGuide[] {
    // Para layout personalizado, verificar guias salvas no slide ou temporárias
    if (layoutId === 'layout-custom') {
      const currentSlide = this.slideService.currentSlide();
      if (currentSlide?.customGridGuides && currentSlide.customGridGuides.length > 0) {
        return currentSlide.customGridGuides;
      }
      const customGuides = this.slideService.currentGridGuides();
      if (customGuides && customGuides.length > 0) {
        return customGuides;
      }
    }
    
    if (!layoutId) return [];
    const layout = this.slideService.layoutTemplates.find(l => l.id === layoutId);
    return layout?.gridGuides || [];
  }

  // ============== Animações ==============
  
  // Elemento atualmente em preview de animação
  previewAnimationElementId: string | null = null;
  
  // Classe de transição de slide em preview
  previewTransitionClass: string = '';

  private previewAnimationHandler = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { elementId, animation } = customEvent.detail;
    
    // Resetar primeiro para garantir que a animação reinicie
    this.previewAnimationElementId = null;
    this.cdr.detectChanges();
    
    // Aplicar a animação após um pequeno delay
    setTimeout(() => {
      this.previewAnimationElementId = elementId;
      this.cdr.detectChanges();
      
      // Remover a classe após a animação terminar
      const duration = (animation.duration + animation.delay) * 1000 + 100;
      setTimeout(() => {
        this.previewAnimationElementId = null;
        this.cdr.detectChanges();
      }, duration);
    }, 50);
  };

  private previewTransitionHandler = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { transitionType, duration } = customEvent.detail;
    
    // Resetar primeiro
    this.previewTransitionClass = '';
    this.cdr.detectChanges();
    
    // Aplicar a transição após um pequeno delay
    setTimeout(() => {
      this.previewTransitionClass = `transition-${transitionType}-enter`;
      this.cdr.detectChanges();
      
      // Remover a classe após a animação terminar
      setTimeout(() => {
        this.previewTransitionClass = '';
        this.cdr.detectChanges();
      }, (duration || 0.5) * 1000 + 100);
    }, 50);
  };

  ngOnInit(): void {
    // Escutar eventos de preview de animação
    document.addEventListener('preview-animation', this.previewAnimationHandler);
    // Escutar eventos de preview de transição
    document.addEventListener('preview-transition', this.previewTransitionHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('preview-animation', this.previewAnimationHandler);
    document.removeEventListener('preview-transition', this.previewTransitionHandler);
  }

  // Gerar classes de animação para um elemento
  getAnimationClasses(element: ImageElement | TextElement): string {
    const classes: string[] = [];
    
    if (element.animation && element.animation.type !== 'none') {
      // Se está em preview ou modo de animação
      if (this.previewAnimationElementId === element.id) {
        classes.push('element-animated');
        classes.push(`animate-${element.animation.type}`);
        if (element.animation.repeat) {
          classes.push('animate-repeat');
        }
      }
    }
    
    return classes.join(' ');
  }

  // Gerar estilos de animação para um elemento
  getAnimationStyle(element: ImageElement | TextElement): { [key: string]: string } {
    const styles: { [key: string]: string } = {};
    
    if (element.animation && element.animation.type !== 'none' && this.previewAnimationElementId === element.id) {
      styles['animation-duration'] = `${element.animation.duration}s`;
      styles['animation-delay'] = `${element.animation.delay}s`;
      styles['animation-timing-function'] = element.animation.easing;
    }
    
    return styles;
  }
}
