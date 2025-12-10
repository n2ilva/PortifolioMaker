import { Injectable, signal } from '@angular/core';

declare const google: any;

export interface GooglePhoto {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  selected?: boolean;
  thumbnailLink?: string;
}

export interface GoogleAlbum {
  id: string;
  title: string;
  coverPhotoBaseUrl: string;
  mediaItemsCount: string;
}

@Injectable({
  providedIn: 'root'
})
export class GooglePhotosService {
  private readonly CLIENT_ID = '1093612348738-43kgglh5k9v19nmv04uhf9nufjrljugo.apps.googleusercontent.com';
  // Usando Google Drive API (leitura de fotos + leitura/escrita de arquivos do app)
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');
  
  private tokenClient: any = null;
  private accessToken: string | null = null;
  
  isAuthenticated = signal(false);
  isLoading = signal(false);
  error = signal<string | null>(null);
  userInfo = signal<{ name: string; email: string; picture: string } | null>(null);
  
  albums = signal<GoogleAlbum[]>([]);
  photos = signal<GooglePhoto[]>([]);
  
  private readonly TOKEN_KEY = 'google_photos_token';
  private readonly USER_KEY = 'google_photos_user';
  
  constructor() {
    this.loadFromStorage();
    this.loadGoogleApi();
  }
  
  private loadFromStorage(): void {
    const savedToken = localStorage.getItem(this.TOKEN_KEY);
    const savedUser = localStorage.getItem(this.USER_KEY);
    
    if (savedToken) {
      this.accessToken = savedToken;
      this.isAuthenticated.set(true);
      
      if (savedUser) {
        try {
          this.userInfo.set(JSON.parse(savedUser));
        } catch (e) {
          console.error('Erro ao carregar usuário salvo');
        }
      }
    }
  }
  
  private saveToStorage(): void {
    if (this.accessToken) {
      localStorage.setItem(this.TOKEN_KEY, this.accessToken);
    }
    const user = this.userInfo();
    if (user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }
  
  private clearStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  // Método auxiliar para fazer requisições autenticadas com tratamento de 401
  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Não autenticado');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`
      }
    });

    // Se receber 401, o token expirou - fazer logout
    if (response.status === 401) {
      console.warn('Token expirado, fazendo logout automático');
      this.handleTokenExpired();
      throw new Error('Token expirado');
    }

    return response;
  }

  // Tratar token expirado sem revogar (token já é inválido)
  private handleTokenExpired(): void {
    this.accessToken = null;
    this.isAuthenticated.set(false);
    this.userInfo.set(null);
    this.albums.set([]);
    this.photos.set([]);
    this.driveFolderId = null;
    this.clearStorage();
    this.error.set('Sessão expirada. Por favor, faça login novamente.');
  }

  private loadGoogleApi(): void {
    // Carregar o script do Google Identity Services
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => this.initializeGoogleClient();
      document.head.appendChild(script);
    } else {
      this.initializeGoogleClient();
    }
  }

  private initializeGoogleClient(): void {
    if (typeof google !== 'undefined' && google.accounts) {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            this.accessToken = response.access_token;
            this.isAuthenticated.set(true);
            this.fetchUserInfo().then(() => this.saveToStorage());
            console.log('Google Photos: Login bem sucedido, escopos:', response.scope);
          } else if (response.error) {
            console.error('Google Photos: Erro no login:', response.error);
          }
        },
      });
    }
  }

  async login(): Promise<void> {
    if (!this.tokenClient) {
      console.error('Google client não inicializado');
      return;
    }
    
    // Limpar token anterior
    this.accessToken = null;
    this.error.set(null);
    
    // Forçar prompt de consentimento para garantir novos escopos
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  logout(): void {
    // Revogar token no Google
    if (this.accessToken && typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('Google Photos: Token revogado');
      });
    }
    
    // Limpar estado local e storage
    this.accessToken = null;
    this.isAuthenticated.set(false);
    this.userInfo.set(null);
    this.albums.set([]);
    this.photos.set([]);
    this.error.set(null);
    this.clearStorage();
    
    // Reinicializar cliente para garantir novos escopos no próximo login
    this.initializeGoogleClient();
  }

  private async fetchUserInfo(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.userInfo.set({
          name: data.name,
          email: data.email,
          picture: data.picture
        });
      }
    } catch (error) {
      console.error('Erro ao buscar info do usuário:', error);
    }
  }

  async fetchAlbums(): Promise<void> {
    if (!this.accessToken) return;
    
    this.isLoading.set(true);
    
    try {
      // Usando Google Drive API - buscar pastas que contêm imagens
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'&pageSize=50&fields=files(id,name,thumbnailLink)",
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const albums = (data.files || []).map((folder: any) => ({
          id: folder.id,
          title: folder.name,
          coverPhotoBaseUrl: folder.thumbnailLink || '',
          mediaItemsCount: '0'
        }));
        this.albums.set(albums);
      }
    } catch (error) {
      console.error('Erro ao buscar pastas:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchPhotosFromAlbum(albumId: string): Promise<void> {
    if (!this.accessToken) return;
    
    this.isLoading.set(true);
    
    try {
      // Usando Google Drive API - buscar imagens dentro de uma pasta
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${albumId}'+in+parents+and+(mimeType+contains+'image/')&pageSize=100&fields=files(id,name,mimeType,thumbnailLink,imageMediaMetadata)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const photos = (data.files || []).map((file: any) => ({
          id: file.id,
          baseUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          filename: file.name,
          mimeType: file.mimeType,
          width: file.imageMediaMetadata?.width || 800,
          height: file.imageMediaMetadata?.height || 600,
          selected: false,
          thumbnailLink: file.thumbnailLink
        }));
        
        this.photos.set(photos);
      }
    } catch (error) {
      console.error('Erro ao buscar fotos da pasta:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchAllPhotos(): Promise<void> {
    if (!this.accessToken) {
      console.error('Google Drive: Sem token de acesso');
      return;
    }
    
    this.isLoading.set(true);
    this.error.set(null);
    console.log('Google Drive: Buscando todas as imagens...');
    
    try {
      // Usando Google Drive API - buscar todas as imagens
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType+contains+'image/'&pageSize=100&fields=files(id,name,mimeType,thumbnailLink,imageMediaMetadata)",
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        }
      );
      
      console.log('Google Drive: Status da resposta:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Google Drive: Dados recebidos:', data);
        
        const photos = (data.files || []).map((file: any) => ({
          id: file.id,
          baseUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          filename: file.name,
          mimeType: file.mimeType,
          width: file.imageMediaMetadata?.width || 800,
          height: file.imageMediaMetadata?.height || 600,
          selected: false,
          thumbnailLink: file.thumbnailLink
        }));
        
        console.log('Google Drive: Total de imagens encontradas:', photos.length);
        this.photos.set(photos);
        
        if (photos.length === 0) {
          this.error.set('Nenhuma imagem encontrada no seu Google Drive.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || 'Erro desconhecido';
        console.error('Google Drive: Erro na resposta:', response.status, errorMessage, errorData);
        
        if (response.status === 403) {
          this.error.set(`Erro 403: ${errorMessage}`);
        } else if (response.status === 401) {
          this.error.set('Sessão expirada. Faça login novamente.');
          this.logout();
        } else {
          this.error.set(`Erro ao carregar imagens (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Google Drive: Erro ao buscar imagens:', error);
      this.error.set('Erro de conexão. Verifique sua internet.');
    } finally {
      this.isLoading.set(false);
    }
  }

  togglePhotoSelection(photoId: string): void {
    this.photos.update(photos =>
      photos.map(p => 
        p.id === photoId ? { ...p, selected: !p.selected } : p
      )
    );
  }

  getSelectedPhotos(): GooglePhoto[] {
    return this.photos().filter(p => p.selected);
  }

  clearSelection(): void {
    this.photos.update(photos =>
      photos.map(p => ({ ...p, selected: false }))
    );
  }

  // Converter foto do Google Drive para DataURL para usar nos slides
  async downloadPhotoAsDataUrl(photo: GooglePhoto, maxSize: number = 1920): Promise<string> {
    // Usar a API do Drive para baixar o arquivo
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`;
    
    try {
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Erro ao baixar foto:', error);
      throw error;
    }
  }

  // Download em lote com concorrência limitada para não travar
  async downloadPhotosInBatches(
    photos: GooglePhoto[], 
    batchSize: number = 3,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ photo: GooglePhoto; dataUrl: string }[]> {
    const results: { photo: GooglePhoto; dataUrl: string }[] = [];
    
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (photo) => {
          const dataUrl = await this.downloadPhotoAsDataUrl(photo);
          return { photo, dataUrl };
        })
      );
      
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(results.length, photos.length);
      }
    }
    
    return results;
  }

  // ===== Google Drive - Salvar/Carregar Projetos =====
  
  private readonly DRIVE_FOLDER_NAME = 'PortfolioMaker Projects';
  private driveFolderId: string | null = null;

  // Obter ou criar pasta do app no Google Drive
  private async getOrCreateAppFolder(): Promise<string | null> {
    if (!this.accessToken) return null;
    if (this.driveFolderId) return this.driveFolderId;

    try {
      // Buscar pasta existente
      const searchResponse = await this.authenticatedFetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${this.DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
      );

      if (searchResponse.ok) {
        const data = await searchResponse.json();
        if (data.files && data.files.length > 0) {
          this.driveFolderId = data.files[0].id;
          return this.driveFolderId;
        }
      }

      // Criar nova pasta
      const createResponse = await this.authenticatedFetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: this.DRIVE_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (createResponse.ok) {
        const folder = await createResponse.json();
        this.driveFolderId = folder.id;
        return this.driveFolderId;
      }

      return null;
    } catch (error) {
      console.error('Erro ao acessar pasta do Drive:', error);
      return null;
    }
  }

  // Salvar projeto no Google Drive
  async saveProjectToDrive(
    projectData: any, 
    fileName: string,
    existingFileId?: string
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Não autenticado' };
    }

    try {
      const folderId = await this.getOrCreateAppFolder();
      if (!folderId && !existingFileId) {
        return { success: false, error: 'Não foi possível acessar a pasta no Drive' };
      }

      const metadata: any = {
        name: `${fileName}.pmk`,
        mimeType: 'application/json'
      };

      if (!existingFileId) {
        metadata.parents = [folderId];
      }

      const fileContent = JSON.stringify(projectData);
      const blob = new Blob([fileContent], { type: 'application/json' });

      // Criar form multipart
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const url = existingFileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const response = await this.authenticatedFetch(url, {
        method: existingFileId ? 'PATCH' : 'POST',
        body: form
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, fileId: result.id };
      } else {
        const error = await response.text();
        return { success: false, error: `Erro ao salvar: ${error}` };
      }
    } catch (error: any) {
      console.error('Erro ao salvar no Drive:', error);
      if (error.message === 'Token expirado') {
        return { success: false, error: 'Sessão expirada. Por favor, faça login novamente.' };
      }
      return { success: false, error: 'Erro de conexão com o Drive' };
    }
  }

  // Listar projetos salvos no Drive
  async listDriveProjects(): Promise<{ id: string; name: string; modifiedTime: string }[]> {
    if (!this.accessToken) return [];

    try {
      const folderId = await this.getOrCreateAppFolder();
      if (!folderId) return [];

      const response = await this.authenticatedFetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
      );

      if (response.ok) {
        const data = await response.json();
        return (data.files || []).map((f: any) => ({
          id: f.id,
          name: f.name.replace('.pmk', ''),
          modifiedTime: f.modifiedTime
        }));
      }

      return [];
    } catch (error) {
      console.error('Erro ao listar projetos do Drive:', error);
      return [];
    }
  }

  // Carregar projeto do Drive
  async loadProjectFromDrive(fileId: string): Promise<any | null> {
    if (!this.accessToken) return null;

    try {
      const response = await this.authenticatedFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      );

      if (response.ok) {
        return await response.json();
      }

      return null;
    } catch (error) {
      console.error('Erro ao carregar projeto do Drive:', error);
      return null;
    }
  }

  // Deletar projeto do Drive
  async deleteProjectFromDrive(fileId: string): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const response = await this.authenticatedFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        { method: 'DELETE' }
      );

      return response.ok;
    } catch (error) {
      console.error('Erro ao deletar projeto do Drive:', error);
      return false;
    }
  }
}
