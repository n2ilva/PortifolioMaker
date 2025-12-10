import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlideService } from '../../services/slide.service';
import { ImageElement, TextElement } from '../../models/slide.model';

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

  open(): void {
    this.isOpen = true;
    this.currentSlideIndex = this.getCurrentSlideIndex();
    this.enterFullscreen();
    this.resetControlsTimeout();
  }

  close(): void {
    this.isOpen = false;
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

  nextSlide(): void {
    if (this.currentSlideIndex < this.totalSlides - 1) {
      this.currentSlideIndex++;
      this.resetControlsTimeout();
    }
  }

  prevSlide(): void {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.resetControlsTimeout();
    }
  }

  goToSlide(index: number): void {
    if (index >= 0 && index < this.totalSlides) {
      this.currentSlideIndex = index;
      this.resetControlsTimeout();
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
    const styles: { [key: string]: string } = {
      position: 'absolute',
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      width: `${element.position.width}%`,
      height: `${element.position.height}%`,
      'z-index': `${element.zIndex}`
    };

    if (element.border?.radius) {
      styles['border-radius'] = `${element.border.radius}px`;
    }

    // Opacity é armazenado como 0-100, converter para 0-1
    if (element.opacity !== undefined && element.opacity !== 100) {
      styles['opacity'] = `${element.opacity / 100}`;
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
}
