import { Component, inject, ElementRef, ViewChild, Output, EventEmitter } from '@angular/core';
import { SlideService } from '../../services/slide.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  @Output() startPresentation = new EventEmitter<void>();
  @Output() exportPdf = new EventEmitter<void>();

  isExporting = false;

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

  onStartPresentation(): void {
    this.startPresentation.emit();
  }

  async onExportPdf(): Promise<void> {
    if (this.isExporting) return;
    
    this.isExporting = true;
    const slides = this.slideService.slides();
    
    // PDF em formato paisagem (16:9)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [297, 167] // A4 paisagem proporcional 16:9
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Salvar slide atual
    const currentSlideId = this.slideService.currentSlideId();

    try {
      for (let i = 0; i < slides.length; i++) {
        // Selecionar o slide para renderização
        this.slideService.selectSlide(slides[i].id);
        
        // Aguardar um momento para o DOM atualizar
        await new Promise(resolve => setTimeout(resolve, 300));

        // Capturar o canvas do slide
        const slideCanvas = document.querySelector('.slide-canvas-content') as HTMLElement;
        
        if (slideCanvas) {
          const canvas = await html2canvas(slideCanvas, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          if (i > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }
      }

      // Restaurar slide original
      if (currentSlideId) {
        this.slideService.selectSlide(currentSlideId);
      }

      // Baixar o PDF
      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`portfolio-${date}.pdf`);
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao exportar PDF. Tente novamente.');
    } finally {
      this.isExporting = false;
    }
  }
}
