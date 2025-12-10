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
  // Usando Google Drive API (mais acessível que Photos Library API)
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
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
}
