import { Component, inject, ElementRef, ViewChild, Output, EventEmitter, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlideService } from '../../services/slide.service';
import { GooglePhotosService } from '../../services/google-photos.service';
import { ProjectStateService } from '../../services/project-state.service';
import { VideoExportService, VideoExportProgress } from '../../services/video-export.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-toolbar',
  imports: [CommonModule],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.css'
})
export class Toolbar implements AfterViewChecked {
  slideService = inject(SlideService);
  googlePhotos = inject(GooglePhotosService);
  projectState = inject(ProjectStateService);
  videoExport = inject(VideoExportService);
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('projectNameInput') projectNameInput!: ElementRef<HTMLInputElement>;
  @Output() openBatchImport = new EventEmitter<void>();
  @Output() startPresentation = new EventEmitter<void>();
  @Output() exportPdf = new EventEmitter<void>();
  @Output() openProjects = new EventEmitter<void>();
  @Output() saveProject = new EventEmitter<void>();
  @Output() exportVideo = new EventEmitter<void>();

  isExporting = false;
  isExportingVideo = false;
  videoExportProgress: VideoExportProgress | null = null;
  isMobileMenuOpen = false;
  isEditingName = false;
  private shouldFocusInput = false;

  // Atalho de teclado Ctrl+Z para desfazer
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    // Ctrl+Z ou Cmd+Z (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      // Não desfazer se estiver em um input ou textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      event.preventDefault();
      this.undo();
    }
  }

  // Desfazer última alteração
  undo(): void {
    this.slideService.undo();
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocusInput && this.projectNameInput) {
      this.projectNameInput.nativeElement.focus();
      this.projectNameInput.nativeElement.select();
      this.shouldFocusInput = false;
    }
  }

  startEditName(): void {
    this.isEditingName = true;
    this.shouldFocusInput = true;
  }

  saveProjectName(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    if (newName && newName !== this.projectState.currentProjectName()) {
      this.projectState.setProjectName(newName);
    }
    this.isEditingName = false;
  }

  cancelEditName(): void {
    this.isEditingName = false;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  onOpenProjects(): void {
    this.openProjects.emit();
  }

  onSaveProject(): void {
    this.saveProject.emit();
  }

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

  onToggleGridGuides(): void {
    this.slideService.toggleGridGuides();
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
    
    // Tamanho fixo do canvas em pixels (16:9)
    const canvasWidth = 960;
    const canvasHeight = 540;
    
    // PDF com tamanho EXATO do slide (em mm, convertendo de pixels)
    // 1 pixel = 0.264583 mm (96 DPI)
    const pxToMm = 0.264583;
    const pdfWidthMm = canvasWidth * pxToMm;  // ~254mm
    const pdfHeightMm = canvasHeight * pxToMm; // ~143mm
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm] // Tamanho customizado igual ao slide
    });

    // Salvar estado atual
    const currentSlideId = this.slideService.currentSlideId();
    const currentZoom = this.slideService.zoom();
    
    // Resetar zoom
    this.slideService.setZoom(100);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      for (let i = 0; i < slides.length; i++) {
        this.slideService.selectSlide(slides[i].id);
        await new Promise(resolve => setTimeout(resolve, 300));

        const slideCanvas = document.querySelector('.canvas-wrapper .canvas') as HTMLElement;
        
        if (slideCanvas) {
          // Criar container temporário fora da tela com tamanho fixo
          const tempContainer = document.createElement('div');
          tempContainer.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: ${canvasWidth}px;
            height: ${canvasHeight}px;
            overflow: hidden;
            background: ${slides[i].backgroundColor || '#ffffff'};
          `;
          
          // Clonar o canvas
          const clonedCanvas = slideCanvas.cloneNode(true) as HTMLElement;
          clonedCanvas.style.cssText = `
            width: ${canvasWidth}px !important;
            height: ${canvasHeight}px !important;
            min-width: ${canvasWidth}px !important;
            min-height: ${canvasHeight}px !important;
            max-width: ${canvasWidth}px !important;
            max-height: ${canvasHeight}px !important;
            transform: none !important;
            position: relative;
            background: ${slides[i].backgroundColor || '#ffffff'};
          `;
          
          // Remover elementos de UI do clone
          clonedCanvas.querySelectorAll('.selected, .hovered').forEach(el => {
            el.classList.remove('selected', 'hovered');
          });
          clonedCanvas.querySelectorAll('.alignment-guide, .resize-handle').forEach(el => el.remove());
          
          tempContainer.appendChild(clonedCanvas);
          document.body.appendChild(tempContainer);
          
          // Aguardar renderização
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Capturar
          const canvas = await html2canvas(clonedCanvas, {
            width: canvasWidth,
            height: canvasHeight,
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: slides[i].backgroundColor || '#ffffff',
            logging: false
          });
          
          // Remover container temporário
          document.body.removeChild(tempContainer);
          
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          if (i > 0) {
            pdf.addPage([pdfWidthMm, pdfHeightMm]);
          }
          
          // Adicionar imagem preenchendo toda a página (sem margens)
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
        }
      }

      // Restaurar estado
      if (currentSlideId) {
        this.slideService.selectSlide(currentSlideId);
      }
      this.slideService.setZoom(currentZoom);

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`portfolio-${date}.pdf`);
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao exportar PDF. Tente novamente.');
      this.slideService.setZoom(currentZoom);
    } finally {
      this.isExporting = false;
    }
  }

  onGoogleLogout(): void {
    this.googlePhotos.logout();
  }

  // Exportar como vídeo MP4/WebM
  async onExportVideo(): Promise<void> {
    if (this.isExportingVideo) return;
    
    this.isExportingVideo = true;
    this.videoExportProgress = null;
    
    try {
      const projectName = this.projectState.currentProjectName() || 'apresentacao';
      
      const blob = await this.videoExport.exportToVideo(
        {
          width: 1920,
          height: 1080,
          fps: 30,
          quality: 0.92,
          filename: projectName
        },
        (progress) => {
          this.videoExportProgress = progress;
        }
      );
      
      if (blob) {
        this.videoExport.downloadVideo(blob, projectName);
      }
    } catch (error) {
      console.error('Erro ao exportar vídeo:', error);
      this.videoExportProgress = {
        status: 'error',
        currentSlide: 0,
        totalSlides: this.slideService.slides().length,
        progress: 0,
        message: 'Erro ao exportar vídeo'
      };
    } finally {
      // Manter a mensagem de sucesso/erro por alguns segundos
      setTimeout(() => {
        this.isExportingVideo = false;
        this.videoExportProgress = null;
      }, 3000);
    }
  }
}
