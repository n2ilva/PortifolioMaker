import { Component, inject, ElementRef, ViewChild, Output, EventEmitter } from '@angular/core';
import { SlideService } from '../../services/slide.service';

@Component({
  selector: 'app-toolbar',
  imports: [],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.css'
})
export class Toolbar {
  slideService = inject(SlideService);
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @Output() openBatchImport = new EventEmitter<void>();

  onAddImages(): void {
    this.fileInput.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.slideService.addMultipleImages(files);
      input.value = ''; // Reset input
    }
  }

  onImportBatch(): void {
    this.openBatchImport.emit();
  }

  onNewSlide(): void {
    this.slideService.createSlide('layout-3-images-1-text');
  }

  onAddText(): void {
    this.slideService.addTextToSlide();
  }

  onZoomIn(): void {
    this.slideService.setZoom(this.slideService.zoom() + 10);
  }

  onZoomOut(): void {
    this.slideService.setZoom(this.slideService.zoom() - 10);
  }
  
  onAlignToGrid(): void {
    this.slideService.alignElementsToGrid();
  }

  onDeleteElement(): void {
    const elementId = this.slideService.selectedElementId();
    if (elementId) {
      this.slideService.deleteElement(elementId);
    }
  }

  onDeleteSlide(): void {
    const slideId = this.slideService.currentSlideId();
    if (slideId && this.slideService.slides().length > 1) {
      this.slideService.deleteSlide(slideId);
    }
  }
}
