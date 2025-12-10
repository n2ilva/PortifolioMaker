import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { SlideService } from './slide.service';
import { ProjectStorageService } from './project-storage.service';
import { SupabaseService } from './supabase.service';
import { environment } from '../../environments/environment';

export interface CurrentProjectInfo {
  id: string | null;
  cloudId: string | null;
  name: string;
  savedLocally: boolean;
  savedToCloud: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectStateService {
  private slideService = inject(SlideService);
  private projectStorage = inject(ProjectStorageService);
  private supabase = inject(SupabaseService);
  
  // Estado do projeto atual
  private currentProjectIdSignal = signal<string | null>(null);
  private currentProjectCloudIdSignal = signal<string | null>(null);
  private currentProjectNameSignal = signal<string>('Novo Projeto');
  private hasUnsavedChangesSignal = signal<boolean>(false);
  private lastSavedHashSignal = signal<string>('');
  private autoSaveEnabledSignal = signal<boolean>(true);
  
  // Auto-save debounce
  private autoSaveTimeout: any = null;
  private readonly AUTO_SAVE_DELAY = 3000; // 3 segundos após última alteração
  
  // Computed values públicos
  currentProjectId = computed(() => this.currentProjectIdSignal() || this.currentProjectCloudIdSignal());
  currentProjectDriveId = computed(() => this.currentProjectCloudIdSignal()); // Mantido para compatibilidade
  currentProjectName = computed(() => this.currentProjectNameSignal());
  hasUnsavedChanges = computed(() => this.hasUnsavedChangesSignal());
  
  // Verifica se o projeto já foi salvo em algum lugar
  isProjectSaved = computed(() => {
    return this.currentProjectIdSignal() !== null || this.currentProjectCloudIdSignal() !== null;
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
  
  // Gerar hash simples para comparar estados (inclui nome do projeto e nomes dos slides)
  private computeHash(slides: any[], name?: string): string {
    const projectName = name || this.currentProjectNameSignal();
    const slideNames = slides.map(s => s.name || '').join('|');
    return projectName + '_' + slideNames + '_' + JSON.stringify(slides).length + '_' + slides.length;
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
    
    if (!environment.production) {
      console.log('Auto-salvando projeto...');
    }
    
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
    
    // Salvar no Supabase se tiver ID de nuvem
    if (this.currentProjectCloudIdSignal() && this.supabase.isAuthenticated()) {
      await this.supabase.updateProject(this.currentProjectCloudIdSignal()!, {
        name: projectName,
        slides
      });
    }
    
    // Atualizar hash e marcar como salvo
    this.lastSavedHashSignal.set(this.computeHash(slides));
    this.hasUnsavedChangesSignal.set(false);
    if (!environment.production) {
      console.log('Projeto salvo automaticamente!');
    }
  }
  
  // Definir projeto atual após carregar
  setCurrentProject(
    localId: string | null, 
    cloudId: string | null, 
    name: string
  ) {
    this.currentProjectIdSignal.set(localId);
    this.currentProjectCloudIdSignal.set(cloudId);
    this.currentProjectNameSignal.set(name);
    
    // Atualizar hash para o estado atual (recém carregado = salvo)
    const slides = this.slideService.slides();
    this.lastSavedHashSignal.set(this.computeHash(slides));
    this.hasUnsavedChangesSignal.set(false);
  }
  
  // Limpar projeto atual (novo projeto)
  clearCurrentProject() {
    this.currentProjectIdSignal.set(null);
    this.currentProjectCloudIdSignal.set(null);
    this.currentProjectNameSignal.set('Novo Projeto');
    this.lastSavedHashSignal.set('');
    this.hasUnsavedChangesSignal.set(false);
  }
  
  // Alterar apenas o nome do projeto
  setProjectName(name: string) {
    if (name && name.trim()) {
      this.currentProjectNameSignal.set(name.trim());
      this.hasUnsavedChangesSignal.set(true);
      
      // Disparar auto-save se o projeto já foi salvo anteriormente
      if (this.isProjectSaved() && this.autoSaveEnabledSignal()) {
        this.scheduleAutoSave();
      }
    }
  }
  
  // Marcar como salvo após salvar manualmente
  markAsSaved(localId?: string, cloudId?: string, name?: string) {
    if (localId) this.currentProjectIdSignal.set(localId);
    if (cloudId) this.currentProjectCloudIdSignal.set(cloudId);
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
