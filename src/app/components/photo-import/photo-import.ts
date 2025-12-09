import { Component, inject, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlideService } from '../../services/slide.service';
import { LayoutTemplate } from '../../models/slide.model';

export interface PhotoFile {
  file: File;
  name: string;
  orderNumber: number;
  dataUrl: string;
  targetSlide: number;      // Número do slide destino (1, 2, 3...)
  slotInSlide: number;      // Posição no slide (1, 2, 3...)
}

export interface SlideConfig {
  slideNumber: number;
  layoutId: string;
  layoutName: string;
  imageSlots: number;
  exists: boolean;
  photos: PhotoFile[];
  slideName: string;  // Nome do slide (editável para novos slides)
}

@Component({
  selector: 'app-photo-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './photo-import.html',
  styleUrl: './photo-import.css'
})
export class PhotoImportComponent {
  slideService = inject(SlideService);
  
  @ViewChild('folderInput') folderInput!: ElementRef<HTMLInputElement>;
  @Output() close = new EventEmitter<void>();
  
  isVisible = false;
  isDragOver = false;
  photos: PhotoFile[] = [];
  slideConfigs: SlideConfig[] = [];
  isProcessing = false;
  errorMessage = '';
  successMessage = '';

  // Layout padrão para novos slides
  defaultLayoutId = 'layout-3-images-1-text';

  get layouts(): LayoutTemplate[] {
    return this.slideService.layoutTemplates;
  }

  open(): void {
    this.isVisible = true;
    this.photos = [];
    this.slideConfigs = [];
    this.errorMessage = '';
    this.successMessage = '';
    this.initializeSlideConfigs();
  }

  closeModal(): void {
    this.isVisible = false;
    this.photos = [];
    this.slideConfigs = [];
    this.close.emit();
  }

  private initializeSlideConfigs(): void {
    const slides = this.slideService.slides();
    this.slideConfigs = slides.map((slide, index) => {
      const layout = this.layouts.find(l => l.id === slide.layoutId);
      const imageSlots = this.countImageSlotsInLayout(slide.layoutId || 'layout-custom');
      
      return {
        slideNumber: index + 1,
        layoutId: slide.layoutId || 'layout-custom',
        layoutName: layout?.name || 'Personalizado',
        imageSlots,
        exists: true,
        photos: [],
        slideName: slide.name
      };
    });
  }

  private countImageSlotsInLayout(layoutId: string): number {
    const layout = this.layouts.find(l => l.id === layoutId);
    if (!layout) return 0;
    return layout.elements.filter(e => e.type === 'image').length;
  }

  onSelectFiles(): void {
    this.folderInput.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files) {
      await this.processFiles(Array.from(files));
    }
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      await this.processFiles(Array.from(input.files));
    }
    input.value = '';
  }

  private async processFiles(files: File[]): Promise<void> {
    this.isProcessing = true;
    this.errorMessage = '';

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      this.errorMessage = 'Nenhuma imagem encontrada nos arquivos selecionados.';
      this.isProcessing = false;
      return;
    }

    const photoPromises = imageFiles.map(async (file) => {
      const orderNumber = this.extractOrderNumber(file.name);
      const dataUrl = await this.readFileAsDataUrl(file);
      
      return {
        file,
        name: file.name,
        orderNumber: orderNumber || (this.photos.length + 1),
        dataUrl,
        targetSlide: 1,
        slotInSlide: 1
      } as PhotoFile;
    });

    const newPhotos = await Promise.all(photoPromises);
    this.photos = [...this.photos, ...newPhotos].sort((a, b) => a.orderNumber - b.orderNumber);
    this.autoDistributePhotos();
    this.isProcessing = false;
  }

  private extractOrderNumber(filename: string): number {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    const patterns = [/_(\d+)$/, /-(\d+)$/, /(\d+)$/];

    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  autoDistributePhotos(): void {
    const sortedPhotos = [...this.photos].sort((a, b) => a.orderNumber - b.orderNumber);
    
    let photoIndex = 0;
    let slideNumber = 1;
    
    this.slideConfigs.forEach(config => config.photos = []);
    
    while (photoIndex < sortedPhotos.length) {
      let config = this.slideConfigs.find(c => c.slideNumber === slideNumber);
      
      if (!config) {
        config = this.addNewSlideConfig(slideNumber);
      }
      
      const slotsAvailable = config.imageSlots;
      
      for (let slot = 1; slot <= slotsAvailable && photoIndex < sortedPhotos.length; slot++) {
        const photo = sortedPhotos[photoIndex];
        photo.targetSlide = slideNumber;
        photo.slotInSlide = slot;
        config.photos.push(photo);
        photoIndex++;
      }
      
      slideNumber++;
    }
  }

  private addNewSlideConfig(slideNumber: number): SlideConfig {
    const imageSlots = this.countImageSlotsInLayout(this.defaultLayoutId);
    const layout = this.layouts.find(l => l.id === this.defaultLayoutId);
    
    const newConfig: SlideConfig = {
      slideNumber,
      layoutId: this.defaultLayoutId,
      layoutName: layout?.name || '3 Fotos + Texto',
      imageSlots,
      exists: false,
      photos: [],
      slideName: `Novo Slide ${slideNumber}`
    };
    
    this.slideConfigs.push(newConfig);
    this.slideConfigs.sort((a, b) => a.slideNumber - b.slideNumber);
    
    return newConfig;
  }

  onSlideNameChange(config: SlideConfig, event: Event): void {
    config.slideName = (event.target as HTMLInputElement).value;
  }

  onPhotoSlideChange(photo: PhotoFile, event: Event): void {
    const newSlide = parseInt((event.target as HTMLSelectElement).value, 10);
    photo.targetSlide = newSlide;
    
    let config = this.slideConfigs.find(c => c.slideNumber === newSlide);
    if (!config) {
      config = this.addNewSlideConfig(newSlide);
    }
    
    this.reorganizePhotosInSlides();
  }

  onPhotoSlotChange(photo: PhotoFile, event: Event): void {
    photo.slotInSlide = parseInt((event.target as HTMLSelectElement).value, 10);
  }

  onPhotoOrderChange(photo: PhotoFile, event: Event): void {
    photo.orderNumber = parseInt((event.target as HTMLInputElement).value, 10);
    this.photos.sort((a, b) => a.orderNumber - b.orderNumber);
  }

  onSlideLayoutChange(config: SlideConfig, event: Event): void {
    const layoutId = (event.target as HTMLSelectElement).value;
    config.layoutId = layoutId;
    const layout = this.layouts.find(l => l.id === layoutId);
    config.layoutName = layout?.name || 'Personalizado';
    config.imageSlots = this.countImageSlotsInLayout(layoutId);
    this.autoDistributePhotos();
  }

  private reorganizePhotosInSlides(): void {
    this.slideConfigs.forEach(config => config.photos = []);
    
    this.photos.forEach(photo => {
      let config = this.slideConfigs.find(c => c.slideNumber === photo.targetSlide);
      if (!config) {
        config = this.addNewSlideConfig(photo.targetSlide);
      }
      config.photos.push(photo);
    });
    
    this.slideConfigs.forEach(config => {
      config.photos.sort((a, b) => a.slotInSlide - b.slotInSlide);
    });
  }

  removePhoto(photo: PhotoFile): void {
    const index = this.photos.indexOf(photo);
    if (index > -1) {
      this.photos.splice(index, 1);
      this.autoDistributePhotos();
    }
  }

  getSlideOptions(): number[] {
    const maxSlide = Math.max(
      ...this.slideConfigs.map(c => c.slideNumber),
      ...this.photos.map(p => p.targetSlide || 1),
      this.slideService.slides().length,
      1
    );
    return Array.from({ length: maxSlide + 2 }, (_, i) => i + 1);
  }

  getSlotOptions(slideNumber: number): number[] {
    const config = this.slideConfigs.find(c => c.slideNumber === slideNumber);
    const slots = config?.imageSlots || 3;
    return Array.from({ length: slots }, (_, i) => i + 1);
  }

  async importPhotos(): Promise<void> {
    if (this.photos.length === 0) {
      this.errorMessage = 'Nenhuma foto para importar.';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';

    try {
      const slidesToCreate = this.slideConfigs
        .filter(c => !c.exists && c.photos.length > 0)
        .sort((a, b) => a.slideNumber - b.slideNumber);

      for (const config of slidesToCreate) {
        this.slideService.createSlideWithName(config.layoutId, config.slideName);
        config.exists = true;
      }

      const result = await this.slideService.importPhotosToSlidesAdvanced(this.photos, this.slideConfigs);
      
      this.successMessage = `${result.imported} foto(s) importada(s) com sucesso!`;
      
      if (result.slidesCreated > 0) {
        this.successMessage += ` ${result.slidesCreated} slide(s) criado(s).`;
      }

      setTimeout(() => {
        this.closeModal();
      }, 1500);

    } catch (error) {
      this.errorMessage = 'Erro ao importar fotos. Tente novamente.';
      console.error('Erro na importação:', error);
    }

    this.isProcessing = false;
  }

  getSlidesCount(): number {
    return this.slideService.slides().length;
  }

  getImageSlotCount(): number {
    return this.slideService.getTotalImageSlots();
  }

  getSlidesWithPhotos(): SlideConfig[] {
    return this.slideConfigs.filter(c => c.photos.length > 0);
  }
}
