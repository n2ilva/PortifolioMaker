import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, SupabaseProject } from '../../services/supabase.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SlideService } from '../../services/slide.service';
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectMeta } from '../../models/project.model';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  
  supabase = inject(SupabaseService);
  projectStorage = inject(ProjectStorageService);
  slideService = inject(SlideService);
  projectState = inject(ProjectStateService);
  
  // Estado
  activeTab = signal<'cloud' | 'local'>('cloud');
  isLoading = signal(false);
  isSaving = signal(false);
  showSaveDialog = signal(false);
  showDeleteConfirm = signal(false);
  showUnsavedChangesDialog = signal(false);
  showAuthDialog = signal(false);
  
  // Projetos da nuvem
  cloudProjects = signal<SupabaseProject[]>([]);
  
  // Auth form
  authMode: 'login' | 'register' = 'login';
  authEmail = '';
  authPassword = '';
  authError = signal<string | null>(null);
  authSuccess = signal<string | null>(null);
  
  // Dados para salvar
  saveProjectName = '';
  saveLocation: 'cloud' | 'local' = 'cloud';
  
  // Projeto selecionado para deletar
  projectToDelete: { id: string; name: string; source: 'cloud' | 'local' } | null = null;
  
  // Projeto selecionado para renomear
  showRenameDialog = signal(false);
  projectToRename: { id: string; name: string; source: 'cloud' | 'local' } | null = null;
  renameNewName = '';
  
  // Estado de exportação PDF
  isExportingPdf = false;
  
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
    
    // Se autenticado no Supabase, carregar projetos da nuvem
    if (this.supabase.isAuthenticated()) {
      const projects = await this.supabase.getProjects();
      this.cloudProjects.set(projects);
    }
    
    this.isLoading.set(false);
  }
  
  switchTab(tab: 'cloud' | 'local') {
    this.activeTab.set(tab);
  }
  
  // ==================== AUTENTICAÇÃO ====================
  
  openAuthDialog(mode: 'login' | 'register' = 'login') {
    this.authMode = mode;
    this.authEmail = '';
    this.authPassword = '';
    this.authError.set(null);
    this.authSuccess.set(null);
    this.showAuthDialog.set(true);
  }
  
  async signInWithGoogle() {
    try {
      await this.supabase.signInWithGoogle();
    } catch (error: any) {
      this.authError.set(error.message);
    }
  }
  
  async submitAuth() {
    if (!this.authEmail || !this.authPassword) {
      this.authError.set('Preencha todos os campos');
      return;
    }
    
    this.authError.set(null);
    this.authSuccess.set(null);
    
    try {
      if (this.authMode === 'login') {
        await this.supabase.signInWithEmail(this.authEmail, this.authPassword);
        this.showAuthDialog.set(false);
        await this.loadProjects();
      } else {
        await this.supabase.signUpWithEmail(this.authEmail, this.authPassword);
        this.authSuccess.set('Conta criada! Verifique seu email para confirmar.');
      }
    } catch (error: any) {
      this.authError.set(error.message);
    }
  }
  
  async signOut() {
    await this.supabase.signOut();
    this.cloudProjects.set([]);
  }
  
  // ==================== VERIFICAÇÃO DE ALTERAÇÕES ====================
  
  private checkUnsavedChanges(action: () => void) {
    if (this.projectState.hasUnsavedChanges()) {
      this.pendingAction = action;
      this.showUnsavedChangesDialog.set(true);
    } else {
      action();
    }
  }
  
  async saveAndContinue() {
    if (this.projectState.isProjectSaved()) {
      await this.projectState.saveNow();
      this.showUnsavedChangesDialog.set(false);
      if (this.pendingAction) {
        this.pendingAction();
        this.pendingAction = null;
      }
    } else {
      this.showUnsavedChangesDialog.set(false);
      this.openSaveDialog();
    }
  }
  
  discardAndContinue() {
    this.showUnsavedChangesDialog.set(false);
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }
  
  cancelPendingAction() {
    this.showUnsavedChangesDialog.set(false);
    this.pendingAction = null;
  }
  
  // ==================== GERAR THUMBNAIL ====================
  
  /**
   * Gera uma thumbnail do primeiro slide para usar como capa do projeto
   */
  private async generateThumbnail(): Promise<string | undefined> {
    const slides = this.slideService.slides();
    if (slides.length === 0) return undefined;
    
    // Salvar estado atual
    const currentSlideId = this.slideService.currentSlideId();
    const currentZoom = this.slideService.zoom();
    
    try {
      // Selecionar o primeiro slide
      this.slideService.selectSlide(slides[0].id);
      this.slideService.setZoom(100);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const slideCanvas = document.querySelector('.canvas-wrapper .canvas') as HTMLElement;
      if (!slideCanvas) return undefined;
      
      // Criar container temporário para a thumbnail
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 400px;
        height: 225px;
        overflow: hidden;
        background: ${slides[0].backgroundColor || '#ffffff'};
      `;
      
      const clonedCanvas = slideCanvas.cloneNode(true) as HTMLElement;
      clonedCanvas.style.cssText = `
        width: 400px !important;
        height: 225px !important;
        transform: none !important;
        position: relative;
        background: ${slides[0].backgroundColor || '#ffffff'};
      `;
      
      // Remover elementos de UI (seleção, guias, etc)
      clonedCanvas.querySelectorAll('.selected, .hovered').forEach(el => {
        el.classList.remove('selected', 'hovered');
      });
      clonedCanvas.querySelectorAll('.alignment-guide, .resize-handle, .layout-grid-guide').forEach(el => el.remove());
      
      tempContainer.appendChild(clonedCanvas);
      document.body.appendChild(tempContainer);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(clonedCanvas, {
        width: 400,
        height: 225,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: slides[0].backgroundColor || '#ffffff',
        logging: false
      });
      
      document.body.removeChild(tempContainer);
      
      // Converter para base64 com qualidade reduzida para economizar espaço
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      
      // Restaurar estado
      if (currentSlideId) {
        this.slideService.selectSlide(currentSlideId);
      }
      this.slideService.setZoom(currentZoom);
      
      return thumbnail;
    } catch (error) {
      console.error('Erro ao gerar thumbnail:', error);
      // Restaurar estado mesmo em caso de erro
      if (currentSlideId) {
        this.slideService.selectSlide(currentSlideId);
      }
      this.slideService.setZoom(currentZoom);
      return undefined;
    }
  }
  
  // ==================== SALVAR PROJETO ====================
  
  openSaveDialog() {
    this.saveProjectName = this.projectState.currentProjectName() || `Projeto ${new Date().toLocaleDateString('pt-BR')}`;
    this.saveLocation = this.supabase.isAuthenticated() ? 'cloud' : 'local';
    this.showSaveDialog.set(true);
  }
  
  async saveProject() {
    if (!this.saveProjectName.trim()) return;
    
    this.isSaving.set(true);
    
    try {
      const slides = this.slideService.slides();
      const currentSlideId = this.slideService.currentSlideId();
      
      // Gerar thumbnail do primeiro slide
      const thumbnail = await this.generateThumbnail();
      
      let savedProjectId: string | undefined;
      
      if (this.saveLocation === 'cloud' && this.supabase.isAuthenticated()) {
        // Salvar no Supabase
        const existingProjectId = this.projectState.currentProjectId();
        
        if (existingProjectId && this.cloudProjects().some(p => p.id === existingProjectId)) {
          // Atualizar projeto existente na nuvem
          const success = await this.supabase.updateProject(existingProjectId, {
            name: this.saveProjectName,
            slides,
            thumbnail: thumbnail || null
          });
          if (success) {
            savedProjectId = existingProjectId;
          }
        } else {
          // Criar novo projeto
          const project = await this.supabase.createProject(this.saveProjectName, slides, thumbnail);
          if (project) {
            savedProjectId = project.id;
          }
        }
      } else {
        // Salvar localmente
        const result = await this.projectStorage.saveProject(
          this.saveProjectName,
          slides,
          currentSlideId,
          this.projectState.currentProjectId() || undefined,
          thumbnail
        );
        
        if (result.success) {
          savedProjectId = result.projectId;
        }
      }
      
      // Atualizar estado do projeto
      if (savedProjectId) {
        this.projectState.markAsSaved(
          this.saveLocation === 'local' ? savedProjectId : undefined,
          this.saveLocation === 'cloud' ? savedProjectId : undefined,
          this.saveProjectName
        );
      }
      
      await this.loadProjects();
      
      this.showSaveDialog.set(false);
      
      if (this.pendingAction) {
        this.pendingAction();
        this.pendingAction = null;
      }
      
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
    } finally {
      this.isSaving.set(false);
    }
  }
  
  // ==================== CARREGAR PROJETOS ====================
  
  async loadCloudProject(project: SupabaseProject) {
    const doLoad = async () => {
      this.isLoading.set(true);
      
      try {
        const fullProject = await this.supabase.getProject(project.id);
        if (fullProject) {
          this.slideService.loadProjectData(fullProject.slides, null);
          this.projectState.setCurrentProject(fullProject.id, null, fullProject.name);
          this.projectLoaded.emit();
          this.close.emit();
        }
      } catch (error) {
        console.error('Erro ao carregar projeto:', error);
      } finally {
        this.isLoading.set(false);
      }
    };
    
    this.checkUnsavedChanges(doLoad);
  }
  
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
  
  // ==================== DELETAR PROJETOS ====================
  
  confirmDelete(id: string, name: string, source: 'cloud' | 'local') {
    this.projectToDelete = { id, name, source };
    this.showDeleteConfirm.set(true);
  }
  
  async deleteProject() {
    if (!this.projectToDelete) return;
    
    this.isLoading.set(true);
    
    try {
      if (this.projectToDelete.source === 'cloud') {
        await this.supabase.deleteProject(this.projectToDelete.id);
      } else {
        await this.projectStorage.deleteProject(this.projectToDelete.id);
      }
      
      await this.loadProjects();
    } catch (error) {
      console.error('Erro ao deletar projeto:', error);
    } finally {
      this.projectToDelete = null;
      this.showDeleteConfirm.set(false);
      this.isLoading.set(false);
    }
  }
  
  // ==================== RENOMEAR PROJETO ====================
  
  openRenameDialog(id: string, name: string, source: 'cloud' | 'local') {
    this.projectToRename = { id, name, source };
    this.renameNewName = name;
    this.showRenameDialog.set(true);
  }
  
  async renameProject() {
    if (!this.projectToRename || !this.renameNewName.trim()) return;
    
    this.isLoading.set(true);
    
    try {
      if (this.projectToRename.source === 'cloud') {
        await this.supabase.updateProject(this.projectToRename.id, {
          name: this.renameNewName.trim()
        });
      } else {
        await this.projectStorage.renameProject(this.projectToRename.id, this.renameNewName.trim());
      }
      
      await this.loadProjects();
    } catch (error) {
      console.error('Erro ao renomear projeto:', error);
    } finally {
      this.projectToRename = null;
      this.showRenameDialog.set(false);
      this.isLoading.set(false);
    }
  }
  
  // ==================== DUPLICAR PROJETO ====================
  
  async duplicateProject(id: string, name: string, source: 'cloud' | 'local') {
    this.isLoading.set(true);
    
    try {
      const newName = `${name} (cópia)`;
      
      if (source === 'cloud') {
        // Buscar projeto original
        const original = await this.supabase.getProject(id);
        if (original) {
          // Criar novo projeto com os mesmos dados
          await this.supabase.createProject(newName, original.slides, original.thumbnail || undefined);
        }
      } else {
        // Duplicar projeto local
        await this.projectStorage.duplicateProject(id, newName);
      }
      
      await this.loadProjects();
    } catch (error) {
      console.error('Erro ao duplicar projeto:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
  
  // ==================== NOVO PROJETO ====================
  
  newProject() {
    const doNew = () => {
      this.slideService.resetToNewProject();
      this.projectState.clearCurrentProject();
      this.close.emit();
    };
    
    this.checkUnsavedChanges(doNew);
  }
  
  // ==================== EXPORTAR/IMPORTAR ====================
  
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
  
  async importProject(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    const text = await file.text();
    
    const result = await this.projectStorage.importProjectFromJson(text);
    if (result.success) {
      await this.loadProjects();
    }
    
    input.value = '';
  }
  
  // ==================== UTILITÁRIOS ====================
  
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
  
  closeModal() {
    this.showSaveDialog.set(false);
    this.showDeleteConfirm.set(false);
    this.showUnsavedChangesDialog.set(false);
    this.showAuthDialog.set(false);
    this.close.emit();
  }
  
  getUserInfo() {
    return this.supabase.getUserInfo();
  }
  
  // ==================== EXPORTAR PDF ====================
  
  async exportPdf(): Promise<void> {
    if (this.isExportingPdf) return;
    
    this.isExportingPdf = true;
    const slides = this.slideService.slides();
    
    // Tamanho fixo do canvas em pixels (16:9)
    const canvasWidth = 960;
    const canvasHeight = 540;
    
    // PDF com tamanho EXATO do slide (em mm, convertendo de pixels)
    const pxToMm = 0.264583;
    const pdfWidthMm = canvasWidth * pxToMm;
    const pdfHeightMm = canvasHeight * pxToMm;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm]
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
          
          clonedCanvas.querySelectorAll('.selected, .hovered').forEach(el => {
            el.classList.remove('selected', 'hovered');
          });
          clonedCanvas.querySelectorAll('.alignment-guide, .resize-handle').forEach(el => el.remove());
          
          tempContainer.appendChild(clonedCanvas);
          document.body.appendChild(tempContainer);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const canvas = await html2canvas(clonedCanvas, {
            width: canvasWidth,
            height: canvasHeight,
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: slides[i].backgroundColor || '#ffffff',
            logging: false
          });
          
          document.body.removeChild(tempContainer);
          
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          if (i > 0) {
            pdf.addPage([pdfWidthMm, pdfHeightMm]);
          }
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
        }
      }

      if (currentSlideId) {
        this.slideService.selectSlide(currentSlideId);
      }
      this.slideService.setZoom(currentZoom);

      const projectName = this.projectState.currentProjectName() || 'portfolio';
      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`${projectName}-${date}.pdf`);
      
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Erro ao exportar PDF. Tente novamente.');
      this.slideService.setZoom(currentZoom);
    } finally {
      this.isExportingPdf = false;
    }
  }
}
