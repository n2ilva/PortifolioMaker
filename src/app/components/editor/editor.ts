import { Component, inject, ViewChild, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlideService } from '../../services/slide.service';
import { SlideCanvas } from '../slide-canvas/slide-canvas';
import { Sidebar } from '../sidebar/sidebar';
import { SlideList } from '../slide-list/slide-list';
import { Toolbar } from '../toolbar/toolbar';
import { PhotoImportComponent } from '../photo-import/photo-import';
import { PresentationComponent } from '../presentation/presentation';
import { ProjectManager } from '../project-manager/project-manager';

@Component({
  selector: 'app-editor',
  imports: [CommonModule, SlideCanvas, Sidebar, SlideList, Toolbar, PhotoImportComponent, PresentationComponent, ProjectManager],
  templateUrl: './editor.html',
  styleUrl: './editor.css'
})
export class Editor {
  slideService = inject(SlideService);
  
  @ViewChild('photoImport') photoImport!: PhotoImportComponent;
  @ViewChild('presentation') presentation!: PresentationComponent;
  @ViewChild('projectManager') projectManager!: ProjectManager;
  
  showProjectManager = signal(false);
  
  // Controle dos painéis laterais
  showSlideList = signal(true);
  showSidebar = signal(true);
  isMobile = signal(false);
  
  constructor() {
    this.checkScreenSize();
  }
  
  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }
  
  private checkScreenSize() {
    const wasMobile = this.isMobile();
    this.isMobile.set(window.innerWidth < 900);
    
    // Ao entrar no modo mobile, ocultar painéis por padrão
    if (!wasMobile && this.isMobile()) {
      this.showSlideList.set(false);
      this.showSidebar.set(false);
    }
    // Ao sair do modo mobile, mostrar painéis
    if (wasMobile && !this.isMobile()) {
      this.showSlideList.set(true);
      this.showSidebar.set(true);
    }
  }
  
  toggleSlideList() {
    this.showSlideList.update(v => !v);
    // Em mobile, fechar o outro painel ao abrir um
    if (this.isMobile() && this.showSlideList()) {
      this.showSidebar.set(false);
    }
  }
  
  toggleSidebar() {
    this.showSidebar.update(v => !v);
    // Em mobile, fechar o outro painel ao abrir um
    if (this.isMobile() && this.showSidebar()) {
      this.showSlideList.set(false);
    }
  }

  openBatchImport(): void {
    this.photoImport.open();
  }

  startPresentation(): void {
    this.presentation.open();
  }
  
  openProjects(): void {
    this.showProjectManager.set(true);
  }
  
  closeProjects(): void {
    this.showProjectManager.set(false);
  }
  
  saveProject(): void {
    this.showProjectManager.set(true);
    // O ProjectManager abrirá automaticamente o diálogo de salvar
    setTimeout(() => {
      this.projectManager.openSaveDialog();
    }, 100);
  }
}
