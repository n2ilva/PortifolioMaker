import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectStorageService } from '../../services/project-storage.service';
import { GooglePhotosService } from '../../services/google-photos.service';
import { SlideService } from '../../services/slide.service';
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectMeta } from '../../models/project.model';

interface DriveProject {
  id: string;
  name: string;
  modifiedTime: string;
}

@Component({
  selector: 'app-project-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-manager.html',
  styleUrl: './project-manager.css'
})
export class ProjectManager implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() projectLoaded = new EventEmitter<void>();
  
  projectStorage = inject(ProjectStorageService);
  googleService = inject(GooglePhotosService);
  slideService = inject(SlideService);
  projectState = inject(ProjectStateService);
  
  // Estado
  activeTab = signal<'local' | 'drive'>('local');
  isLoading = signal(false);
  isSaving = signal(false);
  showSaveDialog = signal(false);
  showDeleteConfirm = signal(false);
  showUnsavedChangesDialog = signal(false);
  
  // Projetos do Drive
  driveProjects = signal<DriveProject[]>([]);
  
  // Dados para salvar
  saveProjectName = '';
  saveLocation: 'local' | 'drive' | 'both' = 'local';
  
  // Projeto selecionado para deletar
  projectToDelete: { id: string; name: string; source: 'local' | 'drive' } | null = null;
  
  // Ação pendente após confirmação de salvar
  pendingAction: (() => void) | null = null;
  
  ngOnInit() {
    this.loadProjects();
    // Preencher nome do projeto atual se existir
    if (this.projectState.currentProjectName()) {
      this.saveProjectName = this.projectState.currentProjectName();
    }
  }
  
  async loadProjects() {
    this.isLoading.set(true);
    
    // Carregar projetos locais
    await this.projectStorage.loadProjectsList();
    
    // Se autenticado, carregar do Drive também
    if (this.googleService.isAuthenticated()) {
      const driveList = await this.googleService.listDriveProjects();
      this.driveProjects.set(driveList);
    }
    
    this.isLoading.set(false);
  }
  
  switchTab(tab: 'local' | 'drive') {
    this.activeTab.set(tab);
    
    if (tab === 'drive' && !this.googleService.isAuthenticated()) {
      // Não mostra nada, precisa logar
    }
  }
  
  // Verificar se há alterações não salvas antes de uma ação
  private checkUnsavedChanges(action: () => void) {
    if (this.projectState.hasUnsavedChanges()) {
      this.pendingAction = action;
      this.showUnsavedChangesDialog.set(true);
    } else {
      action();
    }
  }
  
  // Salvar e continuar ação pendente
  async saveAndContinue() {
    // Se já tem projeto salvo, fazer auto-save
    if (this.projectState.isProjectSaved()) {
      await this.projectState.saveNow();
      this.showUnsavedChangesDialog.set(false);
      if (this.pendingAction) {
        this.pendingAction();
        this.pendingAction = null;
      }
    } else {
      // Precisa salvar manualmente primeiro
      this.showUnsavedChangesDialog.set(false);
      this.openSaveDialog();
    }
  }
  
  // Descartar alterações e continuar
  discardAndContinue() {
    this.showUnsavedChangesDialog.set(false);
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }
  
  // Cancelar ação
  cancelPendingAction() {
    this.showUnsavedChangesDialog.set(false);
    this.pendingAction = null;
  }
  
  // Abrir diálogo de salvar
  openSaveDialog() {
    this.saveProjectName = this.projectState.currentProjectName() || `Projeto ${new Date().toLocaleDateString('pt-BR')}`;
    this.saveLocation = this.googleService.isAuthenticated() ? 'both' : 'local';
    this.showSaveDialog.set(true);
  }
  
  // Salvar projeto atual
  async saveProject() {
    if (!this.saveProjectName.trim()) return;
    
    this.isSaving.set(true);
    
    try {
      const slides = this.slideService.slides();
      const currentSlideId = this.slideService.currentSlideId();
      
      // Gerar thumbnail do primeiro slide (simplificado)
      const thumbnail = await this.generateThumbnail();
      
      const projectData = {
        name: this.saveProjectName,
        slides,
        currentSlideId,
        thumbnail,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };
      
      let savedLocalId: string | undefined;
      let savedDriveId: string | undefined;
      
      // Salvar localmente
      if (this.saveLocation === 'local' || this.saveLocation === 'both') {
        const result = await this.projectStorage.saveProject(
          this.saveProjectName,
          slides,
          currentSlideId,
          this.projectState.currentProjectId() || undefined,
          thumbnail
        );
        
        if (result.success) {
          savedLocalId = result.projectId;
        }
      }
      
      // Salvar no Drive
      if ((this.saveLocation === 'drive' || this.saveLocation === 'both') && 
          this.googleService.isAuthenticated()) {
        const driveResult = await this.googleService.saveProjectToDrive(
          projectData,
          this.saveProjectName,
          this.projectState.currentProjectDriveId() || undefined
        );
        
        if (driveResult.success && driveResult.fileId) {
          savedDriveId = driveResult.fileId;
        }
      }
      
      // Atualizar estado do projeto
      this.projectState.markAsSaved(savedLocalId, savedDriveId, this.saveProjectName);
      
      // Recarregar listas
      await this.loadProjects();
      
      this.showSaveDialog.set(false);
      this.isSaving.set(false);
      
      // Se tinha ação pendente, executar
      if (this.pendingAction) {
        this.pendingAction();
        this.pendingAction = null;
      }
      
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      this.isSaving.set(false);
    }
  }
  
  // Gerar thumbnail simples
  private async generateThumbnail(): Promise<string | undefined> {
    // Por enquanto, retorna undefined
    // Poderia usar html2canvas para gerar uma miniatura real
    return undefined;
  }
  
  // Carregar projeto local
  async loadLocalProject(projectMeta: ProjectMeta) {
    const doLoad = async () => {
      this.isLoading.set(true);
      
      const project = await this.projectStorage.loadProject(projectMeta.id);
      if (project) {
        this.slideService.loadProjectData(project.slides, project.currentSlideId);
        this.projectState.setCurrentProject(project.id, null, project.name);
        this.projectLoaded.emit();
        this.close.emit();
      }
      
      this.isLoading.set(false);
    };
    
    this.checkUnsavedChanges(doLoad);
  }
  
  // Carregar projeto do Drive
  async loadDriveProject(driveProject: DriveProject) {
    const doLoad = async () => {
      this.isLoading.set(true);
      
      const project = await this.googleService.loadProjectFromDrive(driveProject.id);
      if (project && project.slides) {
        this.slideService.loadProjectData(project.slides, project.currentSlideId);
        this.projectState.setCurrentProject(null, driveProject.id, driveProject.name);
        this.projectLoaded.emit();
        this.close.emit();
      }
      
      this.isLoading.set(false);
    };
    
    this.checkUnsavedChanges(doLoad);
  }
  
  // Confirmar exclusão
  confirmDelete(id: string, name: string, source: 'local' | 'drive') {
    this.projectToDelete = { id, name, source };
    this.showDeleteConfirm.set(true);
  }
  
  // Deletar projeto
  async deleteProject() {
    if (!this.projectToDelete) return;
    
    this.isLoading.set(true);
    
    if (this.projectToDelete.source === 'local') {
      await this.projectStorage.deleteProject(this.projectToDelete.id);
    } else {
      await this.googleService.deleteProjectFromDrive(this.projectToDelete.id);
    }
    
    await this.loadProjects();
    
    this.projectToDelete = null;
    this.showDeleteConfirm.set(false);
    this.isLoading.set(false);
  }
  
  // Criar novo projeto
  newProject() {
    const doNew = () => {
      this.slideService.resetToNewProject();
      this.projectState.clearCurrentProject();
      this.close.emit();
    };
    
    this.checkUnsavedChanges(doNew);
  }
  
  // Exportar projeto como arquivo
  async exportProject(projectMeta: ProjectMeta) {
    const json = await this.projectStorage.exportProjectAsJson(projectMeta.id);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectMeta.name}.pmk.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
  
  // Importar projeto de arquivo
  async importProject(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    const text = await file.text();
    
    const result = await this.projectStorage.importProjectFromJson(text);
    if (result.success) {
      await this.loadProjects();
    }
    
    // Limpar input
    input.value = '';
  }
  
  // Formatar data
  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Fechar modal
  closeModal() {
    this.showSaveDialog.set(false);
    this.showDeleteConfirm.set(false);
    this.showUnsavedChangesDialog.set(false);
    this.close.emit();
  }
}
