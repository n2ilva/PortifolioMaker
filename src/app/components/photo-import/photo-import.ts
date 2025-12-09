import { Component, inject, ViewChild, ElementRef, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlideService } from '../../services/slide.service';
import { GooglePhotosService, GooglePhoto, GoogleAlbum } from '../../services/google-photos.service';
import { LayoutTemplate } from '../../models/slide.model';

export interface PhotoFile {
  file: File | null;
  name: string;
  orderNumber: number;
  dataUrl: string;
  targetSlide: number;      // Número do slide destino (1, 2, 3...)
  slotInSlide: number;      // Posição no slide (1, 2, 3...)
  fromGoogle?: boolean;     // Se veio do Google Fotos
  googlePhoto?: GooglePhoto; // Referência à foto do Google
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
  googlePhotos = inject(GooglePhotosService);
  
  @ViewChild('folderInput') folderInput!: ElementRef<HTMLInputElement>;
  @Output() close = new EventEmitter<void>();
  
  isVisible = false;
  isDragOver = false;
  photos: PhotoFile[] = [];
  slideConfigs: SlideConfig[] = [];
  isProcessing = false;
  errorMessage = '';
  successMessage = '';

  // Google Photos
  showGooglePhotos = false;
  googleView: 'albums' | 'photos' | 'all-photos' = 'albums';
  selectedAlbum: GoogleAlbum | null = null;

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
    this.showGooglePhotos = false;
    this.googleView = 'albums';
    this.selectedAlbum = null;
    this.initializeSlideConfigs();
  }

  closeModal(): void {
    this.isVisible = false;
    this.photos = [];
    this.slideConfigs = [];
    this.showGooglePhotos = false;
    this.googlePhotos.clearSelection();
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

  private cdr = inject(ChangeDetectorRef);

  private async processFiles(files: File[]): Promise<void> {
    this.isProcessing = true;
    this.errorMessage = '';

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      this.errorMessage = 'Nenhuma imagem encontrada nos arquivos selecionados.';
      this.isProcessing = false;
      return;
    }

    this.downloadProgress = { completed: 0, total: imageFiles.length };
    this.cdr.detectChanges();
    
    const newPhotos: PhotoFile[] = [];
    const batchSize = 3;
    
    try {
      for (let i = 0; i < imageFiles.length; i += batchSize) {
        const batch = imageFiles.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              const orderNumber = this.extractOrderNumber(file.name);
              const dataUrl = await this.resizeAndReadFile(file, 1920);
              
              return {
                file,
                name: file.name,
                orderNumber: orderNumber || (this.photos.length + newPhotos.length + 1),
                dataUrl,
                targetSlide: 1,
                slotInSlide: 1
              } as PhotoFile;
            } catch (err) {
              console.error('Erro ao processar arquivo:', file.name, err);
              return null;
            }
          })
        );
        
        // Filtrar resultados nulos (erros)
        const validResults = batchResults.filter((r): r is PhotoFile => r !== null);
        newPhotos.push(...validResults);
        
        this.downloadProgress = { completed: newPhotos.length, total: imageFiles.length };
        this.cdr.detectChanges();
        
        // Pequeno delay para permitir UI atualizar
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.photos = [...this.photos, ...newPhotos].sort((a, b) => a.orderNumber - b.orderNumber);
      this.autoDistributePhotos();
      
    } catch (error) {
      console.error('Erro ao processar arquivos:', error);
      this.errorMessage = 'Erro ao processar algumas imagens.';
    }
    
    this.isProcessing = false;
    this.downloadProgress = { completed: 0, total: 0 };
    this.cdr.detectChanges();
  }

  // Redimensionar imagem para melhor performance
  private resizeAndReadFile(file: File, maxSize: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          reject(new Error('Falha ao ler arquivo'));
          return;
        }
        
        const img = new Image();
        
        img.onload = () => {
          try {
            // Verificar se precisa redimensionar
            if (img.width <= maxSize && img.height <= maxSize) {
              resolve(result);
              return;
            }
            
            // Calcular novas dimensões mantendo proporção
            let width = img.width;
            let height = img.height;
            
            if (width > height && width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
            
            // Criar canvas e redimensionar
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
              resolve(result);
            }
          } catch (err) {
            console.error('Erro no processamento da imagem:', err);
            resolve(result); // Retorna original em caso de erro
          }
        };
        
        img.onerror = () => {
          reject(new Error('Falha ao carregar imagem'));
        };
        
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
    
    // Limpar fotos de todas as configs
    this.slideConfigs.forEach(config => config.photos = []);
    
    let photoIndex = 0;
    let slideNumber = 1;
    
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
    const oldSlide = photo.targetSlide;
    
    // Criar config do novo slide se não existir
    let newConfig = this.slideConfigs.find(c => c.slideNumber === newSlide);
    if (!newConfig) {
      newConfig = this.addNewSlideConfig(newSlide);
    }
    
    // Encontrar próxima posição disponível no novo slide
    const photosInNewSlide = this.photos.filter(p => p !== photo && p.targetSlide === newSlide);
    const usedSlots = photosInNewSlide.map(p => p.slotInSlide);
    let nextSlot = 1;
    while (usedSlots.includes(nextSlot) && nextSlot <= newConfig.imageSlots) {
      nextSlot++;
    }
    
    // Atualizar foto
    photo.targetSlide = newSlide;
    photo.slotInSlide = Math.min(nextSlot, newConfig.imageSlots);
    
    // Reorganizar
    this.reorganizePhotosInSlides();
  }

  onPhotoSlotChange(photo: PhotoFile, event: Event): void {
    const newSlot = parseInt((event.target as HTMLSelectElement).value, 10);
    const config = this.slideConfigs.find(c => c.slideNumber === photo.targetSlide);
    
    if (config) {
      // Verificar se a posição já está ocupada por outra foto
      const photoInSlot = config.photos.find(p => p !== photo && p.slotInSlide === newSlot);
      
      if (photoInSlot) {
        // Trocar posições
        photoInSlot.slotInSlide = photo.slotInSlide;
      }
      
      photo.slotInSlide = newSlot;
      this.reorganizePhotosInSlides();
    }
  }

  onPhotoOrderChange(photo: PhotoFile, event: Event): void {
    photo.orderNumber = parseInt((event.target as HTMLInputElement).value, 10);
    this.photos.sort((a, b) => a.orderNumber - b.orderNumber);
  }

  onSlideLayoutChange(config: SlideConfig, event: Event): void {
    const layoutId = (event.target as HTMLSelectElement).value;
    const oldImageSlots = config.imageSlots;
    
    config.layoutId = layoutId;
    const layout = this.layouts.find(l => l.id === layoutId);
    config.layoutName = layout?.name || 'Personalizado';
    config.imageSlots = this.countImageSlotsInLayout(layoutId);
    
    // Se o novo layout tem menos slots, redistribuir excedentes
    if (config.imageSlots < oldImageSlots) {
      this.redistributeExcessPhotos(config);
    }
    
    // Reorganizar para atualizar as posições
    this.reorganizePhotosInSlides();
  }

  private redistributeExcessPhotos(changedConfig: SlideConfig): void {
    // Pegar fotos que estão neste slide, ordenadas por slot
    const photosInSlide = this.photos
      .filter(p => p.targetSlide === changedConfig.slideNumber)
      .sort((a, b) => a.slotInSlide - b.slotInSlide);
    
    const slotsAvailable = changedConfig.imageSlots;
    
    // Fotos que cabem no slide
    const photosToKeep = photosInSlide.slice(0, slotsAvailable);
    // Fotos excedentes
    const excessPhotos = photosInSlide.slice(slotsAvailable);
    
    // Atualizar posições das fotos que ficam
    photosToKeep.forEach((photo, index) => {
      photo.slotInSlide = index + 1;
    });
    
    // Mover excedentes para próximos slides
    let nextSlideNumber = changedConfig.slideNumber + 1;
    
    for (const photo of excessPhotos) {
      let targetConfig = this.slideConfigs.find(c => c.slideNumber === nextSlideNumber);
      
      if (!targetConfig) {
        targetConfig = this.addNewSlideConfig(nextSlideNumber);
      }
      
      // Contar fotos já no slide destino
      const photosInTarget = this.photos.filter(p => p !== photo && p.targetSlide === nextSlideNumber);
      
      if (photosInTarget.length >= targetConfig.imageSlots) {
        // Slide cheio, ir para o próximo
        nextSlideNumber++;
        targetConfig = this.addNewSlideConfig(nextSlideNumber);
      }
      
      // Encontrar próxima posição disponível
      const usedSlots = photosInTarget.map(p => p.slotInSlide);
      let nextSlot = 1;
      while (usedSlots.includes(nextSlot)) {
        nextSlot++;
      }
      
      photo.targetSlide = nextSlideNumber;
      photo.slotInSlide = nextSlot;
    }
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
      // 1. Primeiro, criar novos slides na ordem correta
      const slidesToCreate = this.slideConfigs
        .filter(c => !c.exists && c.photos.length > 0)
        .sort((a, b) => a.slideNumber - b.slideNumber);

      for (const config of slidesToCreate) {
        this.slideService.createSlideWithName(config.layoutId, config.slideName);
        config.exists = true;
      }

      // 2. Aplicar layouts modificados em slides existentes
      const existingSlides = this.slideService.slides();
      for (const config of this.slideConfigs) {
        if (config.exists && config.photos.length > 0) {
          const slideIndex = config.slideNumber - 1;
          const slide = existingSlides[slideIndex];
          
          if (slide && slide.layoutId !== config.layoutId) {
            // Aplicar novo layout ao slide existente
            this.slideService.applyLayoutToSlide(slide.id, config.layoutId);
          }
        }
      }

      // 3. Importar fotos nos slots corretos
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

  // ========== Google Photos Methods ==========

  toggleGooglePhotos(): void {
    this.showGooglePhotos = !this.showGooglePhotos;
    if (this.showGooglePhotos && this.googlePhotos.isAuthenticated()) {
      this.googlePhotos.fetchAlbums();
    }
  }

  async onGoogleLogin(): Promise<void> {
    await this.googlePhotos.login();
    
    setTimeout(() => {
      if (this.googlePhotos.isAuthenticated()) {
        this.googlePhotos.fetchAlbums();
      }
    }, 1000);
  }

  onGoogleLogout(): void {
    this.googlePhotos.logout();
    this.googleView = 'albums';
    this.selectedAlbum = null;
  }

  onSelectAlbum(album: GoogleAlbum): void {
    this.selectedAlbum = album;
    this.googleView = 'photos';
    this.googlePhotos.fetchPhotosFromAlbum(album.id);
  }

  onShowAllGooglePhotos(): void {
    this.selectedAlbum = null;
    this.googleView = 'all-photos';
    this.googlePhotos.fetchAllPhotos();
  }

  onBackToAlbums(): void {
    this.googleView = 'albums';
    this.selectedAlbum = null;
    this.googlePhotos.photos.set([]);
  }

  onToggleGooglePhoto(photo: GooglePhoto): void {
    this.googlePhotos.togglePhotoSelection(photo.id);
  }

  getGoogleSelectedCount(): number {
    return this.googlePhotos.getSelectedPhotos().length;
  }

  selectAllGooglePhotos(): void {
    const photos = this.googlePhotos.photos();
    photos.forEach(p => {
      if (!p.selected) {
        this.googlePhotos.togglePhotoSelection(p.id);
      }
    });
  }

  deselectAllGooglePhotos(): void {
    this.googlePhotos.clearSelection();
  }

  // Propriedade para mostrar progresso
  downloadProgress = { completed: 0, total: 0 };

  async addGooglePhotosToImport(): Promise<void> {
    const selectedPhotos = this.googlePhotos.getSelectedPhotos();
    
    if (selectedPhotos.length === 0) {
      this.errorMessage = 'Selecione pelo menos uma foto do Google Fotos.';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';
    this.downloadProgress = { completed: 0, total: selectedPhotos.length };

    try {
      const startOrder = this.photos.length + 1;
      
      // Usar download em lotes para não travar a interface
      const results = await this.googlePhotos.downloadPhotosInBatches(
        selectedPhotos,
        3, // 3 fotos por vez
        (completed, total) => {
          this.downloadProgress = { completed, total };
        }
      );
      
      // Criar PhotoFiles a partir dos resultados
      results.forEach((result, i) => {
        const photoFile: PhotoFile = {
          file: null,
          name: result.photo.filename,
          orderNumber: startOrder + i,
          dataUrl: result.dataUrl,
          targetSlide: 1,
          slotInSlide: 1,
          fromGoogle: true,
          googlePhoto: result.photo
        };
        
        this.photos.push(photoFile);
      });

      // Ordenar e redistribuir
      this.photos.sort((a, b) => a.orderNumber - b.orderNumber);
      this.autoDistributePhotos();
      
      // Limpar seleção e voltar
      this.googlePhotos.clearSelection();
      this.showGooglePhotos = false;
      
      this.successMessage = `${selectedPhotos.length} foto(s) do Google Fotos adicionada(s)!`;
      setTimeout(() => {
        this.successMessage = '';
      }, 3000);
      
    } catch (error) {
      this.errorMessage = 'Erro ao carregar fotos do Google. Tente novamente.';
      console.error('Erro ao carregar Google Photos:', error);
    }

    this.isProcessing = false;
    this.downloadProgress = { completed: 0, total: 0 };
  }
}
