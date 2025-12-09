import { Component, inject, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlideService } from '../../services/slide.service';
import { ImageElement, TextElement, ElementBorderStyle, LayoutGridGuide } from '../../models/slide.model';

@Component({
  selector: 'app-slide-canvas',
  imports: [CommonModule, FormsModule],
  templateUrl: './slide-canvas.html',
  styleUrl: './slide-canvas.css'
})
export class SlideCanvas {
  slideService = inject(SlideService);
  
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

  onElementClick(event: Event, element: ImageElement | TextElement): void {
    event.stopPropagation();
    this.slideService.selectElement(element.id);
  }

  onCanvasClick(): void {
    this.slideService.selectElement(null);
    this.editingTextId = null;
    this.hideHoverMenu();
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
  }

  onElementMouseLeave(event: MouseEvent, element: ImageElement | TextElement): void {
    // Não esconder se o mouse foi para o menu
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('.hover-menu')) {
      return;
    }
    
    this.hideHoverMenu();
  }

  onHoverMenuMouseLeave(): void {
    this.hideHoverMenu();
  }

  hideHoverMenu(): void {
    this.hoveredElementId = null;
    this.slideService.setHoveredElement(null);
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
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = '';
    this.slideService.clearAlignmentGuides();
  }

  getElementStyle(element: ImageElement | TextElement): { [key: string]: string } {
    const isTextElement = element.type === 'text';
    
    const styles: { [key: string]: string } = {
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      width: `${element.position.width}%`,
      'z-index': `${element.zIndex}`
    };

    // Texto tem altura automática, imagem tem altura fixa
    if (isTextElement) {
      styles['height'] = 'auto';
      styles['min-height'] = '30px';
      styles['max-width'] = `calc(100% - ${element.position.x}%)`; // Não ultrapassar o slide
    } else {
      styles['height'] = `${element.position.height}%`;
    }

    // Aplicar borda arredondada
    if (element.border?.radius) {
      styles['border-radius'] = `${element.border.radius}px`;
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
    const styles: { [key: string]: string } = {
      'object-fit': element.fit
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

  asImage(element: ImageElement | TextElement): ImageElement {
    return element as ImageElement;
  }

  asText(element: ImageElement | TextElement): TextElement {
    return element as TextElement;
  }

  // Obter guias de grade do layout atual
  getLayoutGridGuides(layoutId?: string): LayoutGridGuide[] {
    if (!layoutId) return [];
    const layout = this.slideService.layoutTemplates.find(l => l.id === layoutId);
    return layout?.gridGuides || [];
  }
}
