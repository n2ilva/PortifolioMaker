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
  private readonly SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly';
  
  private tokenClient: any = null;
  private accessToken: string | null = null;
  
  isAuthenticated = signal(false);
  isLoading = signal(false);
  userInfo = signal<{ name: string; email: string; picture: string } | null>(null);
  
  albums = signal<GoogleAlbum[]>([]);
  photos = signal<GooglePhoto[]>([]);
  
  constructor() {
    this.loadGoogleApi();
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
            this.fetchUserInfo();
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
    
    this.tokenClient.requestAccessToken();
  }

  logout(): void {
    if (this.accessToken && typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    this.isAuthenticated.set(false);
    this.userInfo.set(null);
    this.albums.set([]);
    this.photos.set([]);
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
      const response = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.albums.set(data.albums || []);
      }
    } catch (error) {
      console.error('Erro ao buscar álbuns:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchPhotosFromAlbum(albumId: string): Promise<void> {
    if (!this.accessToken) return;
    
    this.isLoading.set(true);
    
    try {
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          albumId,
          pageSize: 100
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const photos = (data.mediaItems || [])
          .filter((item: any) => item.mimeType?.startsWith('image/'))
          .map((item: any) => ({
            id: item.id,
            baseUrl: item.baseUrl,
            filename: item.filename,
            mimeType: item.mimeType,
            width: parseInt(item.mediaMetadata?.width || '0'),
            height: parseInt(item.mediaMetadata?.height || '0'),
            selected: false
          }));
        
        this.photos.set(photos);
      }
    } catch (error) {
      console.error('Erro ao buscar fotos:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchAllPhotos(): Promise<void> {
    if (!this.accessToken) {
      console.error('Google Photos: Sem token de acesso');
      return;
    }
    
    this.isLoading.set(true);
    console.log('Google Photos: Buscando todas as fotos...');
    
    try {
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      
      console.log('Google Photos: Status da resposta:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Google Photos: Dados recebidos:', data);
        
        const photos = (data.mediaItems || [])
          .filter((item: any) => item.mimeType?.startsWith('image/'))
          .map((item: any) => ({
            id: item.id,
            baseUrl: item.baseUrl,
            filename: item.filename,
            mimeType: item.mimeType,
            width: parseInt(item.mediaMetadata?.width || '0'),
            height: parseInt(item.mediaMetadata?.height || '0'),
            selected: false
          }));
        
        console.log('Google Photos: Total de fotos encontradas:', photos.length);
        this.photos.set(photos);
      } else {
        const errorText = await response.text();
        console.error('Google Photos: Erro na resposta:', response.status, errorText);
      }
    } catch (error) {
      console.error('Google Photos: Erro ao buscar fotos:', error);
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

  // Converter foto do Google para DataURL para usar nos slides
  // Limita o tamanho para melhor performance (max 1920px no maior lado)
  async downloadPhotoAsDataUrl(photo: GooglePhoto, maxSize: number = 1920): Promise<string> {
    // Calcular dimensões mantendo aspect ratio
    let width = photo.width;
    let height = photo.height;
    
    if (width > height && width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
    
    const imageUrl = `${photo.baseUrl}=w${width}-h${height}`;
    
    try {
      const response = await fetch(imageUrl);
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
