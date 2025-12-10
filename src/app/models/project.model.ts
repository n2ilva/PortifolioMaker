import { Slide } from './slide.model';

// Projeto salvo
export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string; // Base64 ou URL da miniatura
  slides: Slide[];
  currentSlideId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Metadados do projeto (para listagem)
export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  slidesCount: number;
  createdAt: Date;
  updatedAt: Date;
  source: 'local' | 'drive'; // Onde está salvo
  driveFileId?: string; // ID do arquivo no Google Drive
}

// Resultado de operação de salvamento
export interface SaveResult {
  success: boolean;
  projectId: string;
  source: 'local' | 'drive';
  error?: string;
}
