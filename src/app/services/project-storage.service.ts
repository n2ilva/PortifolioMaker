import { Injectable, signal } from '@angular/core';
import { Project, ProjectMeta, SaveResult } from '../models/project.model';
import { Slide } from '../models/slide.model';

const DB_NAME = 'PortfolioMakerDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

@Injectable({
  providedIn: 'root'
})
export class ProjectStorageService {
  private db: IDBDatabase | null = null;
  
  isReady = signal(false);
  projects = signal<ProjectMeta[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  constructor() {
    this.initDatabase();
  }
  
  // Inicializar IndexedDB
  private initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        this.error.set('Erro ao abrir banco de dados local');
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.isReady.set(true);
        this.loadProjectsList();
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Criar object store para projetos
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }
  
  // Carregar lista de projetos
  async loadProjectsList(): Promise<void> {
    if (!this.db) return;
    
    this.isLoading.set(true);
    
    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const projects: Project[] = request.result;
        const metas: ProjectMeta[] = projects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          thumbnail: p.thumbnail,
          slidesCount: p.slides.length,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          source: 'local' as const
        }));
        
        // Ordenar por data de atualização (mais recente primeiro)
        metas.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        this.projects.set(metas);
        this.isLoading.set(false);
      };
      
      request.onerror = () => {
        this.error.set('Erro ao carregar projetos');
        this.isLoading.set(false);
      };
    } catch (e) {
      this.error.set('Erro ao acessar banco de dados');
      this.isLoading.set(false);
    }
  }
  
  // Gerar ID único
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // Salvar projeto localmente
  async saveProject(
    name: string, 
    slides: Slide[], 
    currentSlideId: string | null,
    existingId?: string,
    thumbnail?: string
  ): Promise<SaveResult> {
    if (!this.db) {
      return { success: false, projectId: '', source: 'local', error: 'Banco de dados não inicializado' };
    }
    
    const now = new Date();
    const project: Project = {
      id: existingId || this.generateId(),
      name: name.trim() || 'Projeto sem nome',
      slides,
      currentSlideId,
      thumbnail,
      createdAt: existingId ? now : now, // Será sobrescrito se já existir
      updatedAt: now,
      version: 1
    };
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Se é uma atualização, manter a data de criação original
      if (existingId) {
        const getRequest = store.get(existingId);
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            project.createdAt = new Date(getRequest.result.createdAt);
            project.version = (getRequest.result.version || 0) + 1;
          }
          this.putProject(store, project, resolve);
        };
        getRequest.onerror = () => {
          this.putProject(store, project, resolve);
        };
      } else {
        this.putProject(store, project, resolve);
      }
    });
  }
  
  private putProject(
    store: IDBObjectStore, 
    project: Project, 
    resolve: (result: SaveResult) => void
  ): void {
    const putRequest = store.put(project);
    
    putRequest.onsuccess = () => {
      this.loadProjectsList();
      resolve({ success: true, projectId: project.id, source: 'local' });
    };
    
    putRequest.onerror = () => {
      resolve({ 
        success: false, 
        projectId: project.id, 
        source: 'local', 
        error: 'Erro ao salvar projeto' 
      });
    };
  }
  
  // Carregar projeto
  async loadProject(id: string): Promise<Project | null> {
    if (!this.db) return null;
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => {
        if (request.result) {
          // Converter datas
          const project = request.result;
          project.createdAt = new Date(project.createdAt);
          project.updatedAt = new Date(project.updatedAt);
          project.slides = project.slides.map((s: Slide) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt)
          }));
          resolve(project);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        resolve(null);
      };
    });
  }
  
  // Deletar projeto
  async deleteProject(id: string): Promise<boolean> {
    if (!this.db) return false;
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        this.loadProjectsList();
        resolve(true);
      };
      
      request.onerror = () => {
        resolve(false);
      };
    });
  }
  
  // Duplicar projeto
  async duplicateProject(id: string, newName: string): Promise<SaveResult> {
    const original = await this.loadProject(id);
    if (!original) {
      return { success: false, projectId: '', source: 'local', error: 'Projeto não encontrado' };
    }
    
    return this.saveProject(
      newName,
      original.slides,
      original.currentSlideId,
      undefined, // Novo ID
      original.thumbnail
    );
  }
  
  // Exportar projeto como JSON
  async exportProjectAsJson(id: string): Promise<string | null> {
    const project = await this.loadProject(id);
    if (!project) return null;
    
    return JSON.stringify(project, null, 2);
  }
  
  // Importar projeto de JSON
  async importProjectFromJson(jsonString: string): Promise<SaveResult> {
    try {
      const data = JSON.parse(jsonString);
      
      // Validar estrutura básica
      if (!data.slides || !Array.isArray(data.slides)) {
        return { success: false, projectId: '', source: 'local', error: 'Formato inválido' };
      }
      
      // Salvar com novo ID
      return this.saveProject(
        data.name || 'Projeto Importado',
        data.slides,
        data.currentSlideId || null,
        undefined, // Novo ID
        data.thumbnail
      );
    } catch (e) {
      return { success: false, projectId: '', source: 'local', error: 'Erro ao processar arquivo' };
    }
  }
}
