import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { SlideService } from './slide.service';
import { ProjectStorageService } from './project-storage.service';
import { GooglePhotosService } from './google-photos.service';

export interface CurrentProjectInfo {
  id: string | null;
  driveId: string | null;
  name: string;
  savedLocally: boolean;
  savedToDrive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectStateService {
  private slideService = inject(SlideService);
  private projectStorage = inject(ProjectStorageService);
  private googleService = inject(GooglePhotosService);
  
  // Estado do projeto atual
  private currentProjectIdSignal = signal<string | null>(null);
  private currentProjectDriveIdSignal = signal<string | null>(null);
  private currentProjectNameSignal = signal<string>('Novo Projeto');
  private hasUnsavedChangesSignal = signal<boolean>(false);
  private lastSavedHashSignal = signal<string>('');
  private autoSaveEnabledSignal = signal<boolean>(true);
  
  // Auto-save debounce
  private autoSaveTimeout: any = null;
  private readonly AUTO_SAVE_DELAY = 3000; // 3 segundos após última alteração
  
  // Computed values públicos
  currentProjectId = computed(() => this.currentProjectIdSignal());
  currentProjectDriveId = computed(() => this.currentProjectDriveIdSignal());
  currentProjectName = computed(() => this.currentProjectNameSignal());
  hasUnsavedChanges = computed(() => this.hasUnsavedChangesSignal());
  
  // Verifica se o projeto já foi salvo em algum lugar
  isProjectSaved = computed(() => {
    return this.currentProjectIdSignal() !== null || this.currentProjectDriveIdSignal() !== null;
  });
  
  constructor() {
    // Monitorar mudanças nos slides para detectar alterações não salvas
    effect(() => {
      const slides = this.slideService.slides();
      const currentHash = this.computeHash(slides);
      const lastHash = this.lastSavedHashSignal();
      
      if (lastHash && currentHash !== lastHash) {
        this.hasUnsavedChangesSignal.set(true);
        
        // Disparar auto-save se o projeto já foi salvo anteriormente
        if (this.isProjectSaved() && this.autoSaveEnabledSignal()) {
          this.scheduleAutoSave();
        }
      }
    });
  }
  
  // Gerar hash simples para comparar estados
  private computeHash(slides: any[]): string {
    return JSON.stringify(slides).length + '_' + slides.length;
  }
  
  // Agendar auto-save com debounce
  private scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSave();
    }, this.AUTO_SAVE_DELAY);
  }
  
  // Executar auto-save
  private async autoSave() {
    if (!this.isProjectSaved()) return;
    
    console.log('Auto-salvando projeto...');
    
    const slides = this.slideService.slides();
    const currentSlideId = this.slideService.currentSlideId();
    const projectName = this.currentProjectNameSignal();
    
    // Salvar localmente se tiver ID local
    if (this.currentProjectIdSignal()) {
      await this.projectStorage.saveProject(
        projectName,
        slides,
        currentSlideId,
        this.currentProjectIdSignal()!,
        undefined
      );
    }
    
    // Salvar no Drive se tiver ID do Drive
    if (this.currentProjectDriveIdSignal() && this.googleService.isAuthenticated()) {
      const projectData = {
        name: projectName,
        slides,
        currentSlideId,
        updatedAt: new Date(),
        version: 1
      };
      
      await this.googleService.saveProjectToDrive(
        projectData,
        projectName,
        this.currentProjectDriveIdSignal()!
      );
    }
    
    // Atualizar hash e marcar como salvo
    this.lastSavedHashSignal.set(this.computeHash(slides));
    this.hasUnsavedChangesSignal.set(false);
    console.log('Projeto salvo automaticamente!');
  }
  
  // Definir projeto atual após carregar
  setCurrentProject(
    localId: string | null, 
    driveId: string | null, 
    name: string
  ) {
    this.currentProjectIdSignal.set(localId);
    this.currentProjectDriveIdSignal.set(driveId);
    this.currentProjectNameSignal.set(name);
    
    // Atualizar hash para o estado atual (recém carregado = salvo)
    const slides = this.slideService.slides();
    this.lastSavedHashSignal.set(this.computeHash(slides));
    this.hasUnsavedChangesSignal.set(false);
  }
  
  // Limpar projeto atual (novo projeto)
  clearCurrentProject() {
    this.currentProjectIdSignal.set(null);
    this.currentProjectDriveIdSignal.set(null);
    this.currentProjectNameSignal.set('Novo Projeto');
    this.lastSavedHashSignal.set('');
    this.hasUnsavedChangesSignal.set(false);
  }
  
  // Marcar como salvo após salvar manualmente
  markAsSaved(localId?: string, driveId?: string, name?: string) {
    if (localId) this.currentProjectIdSignal.set(localId);
    if (driveId) this.currentProjectDriveIdSignal.set(driveId);
    if (name) this.currentProjectNameSignal.set(name);
    
    const slides = this.slideService.slides();
    this.lastSavedHashSignal.set(this.computeHash(slides));
    this.hasUnsavedChangesSignal.set(false);
  }
  
  // Habilitar/desabilitar auto-save
  setAutoSaveEnabled(enabled: boolean) {
    this.autoSaveEnabledSignal.set(enabled);
  }
  
  // Forçar salvamento agora
  async saveNow(): Promise<boolean> {
    if (!this.isProjectSaved()) {
      return false; // Precisa salvar manualmente primeiro
    }
    
    await this.autoSave();
    return true;
  }
}
