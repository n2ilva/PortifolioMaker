import { Injectable, signal, inject } from '@angular/core';
import { SecurityService } from './security.service';
import { SupabaseService } from './supabase.service';
import { environment } from '../../environments/environment';

declare const google: any;
declare const gapi: any;

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
  private readonly CLIENT_ID = '1093612348738-f0ghq8c4jiua7sv6pulgt5alo4fqfgnh.apps.googleusercontent.com';
  private readonly API_KEY = 'AIzaSyDummyKeyHere'; // Você precisará criar uma API Key
  
  // Escopos para Drive (salvar projetos) e informações do usuário
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive.file',              // Google Drive - arquivos do app
    'https://www.googleapis.com/auth/drive.readonly',          // Google Drive - leitura
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
  
  // Chaves de armazenamento seguro
  private readonly TOKEN_KEY = 'pm_google_token';
  private readonly USER_KEY = 'pm_google_user';
  private readonly TOKEN_EXPIRY_HOURS = 1; // Token expira em 1 hora por segurança
  
  // Serviço de segurança
  private security = inject(SecurityService);
  private supabaseService = inject(SupabaseService);
  
  /**
   * Log seguro - só exibe em desenvolvimento
   */
  private secureLog(message: string, ...data: any[]): void {
    if (!environment.production) {
      console.log(message, ...data);
    }
  }
  
  constructor() {
    this.loadFromStorageSecure();
    this.loadGoogleApi();
    this.loadGooglePicker();
    
    // Verificar se há token do Supabase Google disponível
    this.trySupabaseGoogleToken();
  }
  
  /**
   * Tenta usar o token do Google do Supabase se disponível
   */
  private async trySupabaseGoogleToken(): Promise<void> {
    // Aguardar o Supabase carregar
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (this.supabaseService.isAuthenticated() && !this.isAuthenticated()) {
      const googleToken = await this.supabaseService.getGoogleAccessToken();
      if (googleToken) {
        this.secureLog('Google Drive: Usando token do Supabase');
        this.accessToken = googleToken;
        this.isAuthenticated.set(true);
        await this.fetchUserInfo();
        await this.saveToStorageSecure();
      }
    }
  }
  
  /**
   * Sincroniza com o token do Supabase (chamado externamente quando necessário)
   */
  async syncWithSupabase(): Promise<boolean> {
    if (this.supabaseService.isAuthenticated()) {
      const googleToken = await this.supabaseService.getGoogleAccessToken();
      if (googleToken) {
        this.secureLog('Google Drive: Sincronizando com token do Supabase');
        this.accessToken = googleToken;
        this.isAuthenticated.set(true);
        await this.fetchUserInfo();
        await this.saveToStorageSecure();
        return true;
      }
    }
    return false;
  }
  
  /**
   * Carrega dados de forma segura (criptografados)
   */
  private async loadFromStorageSecure(): Promise<void> {
    try {
      const savedToken = await this.security.secureRetrieve<string>(this.TOKEN_KEY);
      const savedUser = await this.security.secureRetrieve<{ name: string; email: string; picture: string }>(this.USER_KEY);
      
      if (savedToken) {
        this.accessToken = savedToken;
        this.isAuthenticated.set(true);
        
        if (savedUser) {
          // Sanitizar dados do usuário
          this.userInfo.set({
            name: this.security.sanitize(savedUser.name),
            email: this.security.sanitize(savedUser.email),
            picture: this.security.sanitizeUrl(savedUser.picture)
          });
        }
        
        // Verificar se o token ainda é válido
        this.validateToken();
      }
    } catch (error) {
      console.error('Erro ao carregar dados seguros:', error);
      this.clearStorageSecure();
    }
  }
  
  /**
   * Valida se o token ainda funciona
   */
  private async validateToken(): Promise<void> {
    if (!this.accessToken) return;
    
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + this.accessToken);
      if (!response.ok) {
        console.warn('Token inválido, fazendo logout');
        this.handleTokenExpired();
      }
    } catch {
      // Se não conseguir validar, mantém o token (pode ser problema de rede)
    }
  }
  
  /**
   * Salva dados de forma segura (criptografados)
   */
  private async saveToStorageSecure(): Promise<void> {
    if (this.accessToken) {
      await this.security.secureStore(this.TOKEN_KEY, this.accessToken, this.TOKEN_EXPIRY_HOURS);
    }
    const user = this.userInfo();
    if (user) {
      await this.security.secureStore(this.USER_KEY, user, this.TOKEN_EXPIRY_HOURS);
    }
  }
  
  /**
   * Limpa dados de forma segura
   */
  private clearStorageSecure(): void {
    this.security.secureRemove(this.TOKEN_KEY);
    this.security.secureRemove(this.USER_KEY);
  }
  
  // Métodos legados para compatibilidade (redirecionam para versões seguras)
  private loadFromStorage(): void {
    this.loadFromStorageSecure();
  }
  
  private saveToStorage(): void {
    this.saveToStorageSecure();
  }
  
  private clearStorage(): void {
    this.clearStorageSecure();
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

  private pickerApiLoaded = false;

  private loadGooglePicker(): void {
    // Carregar o script do Google API (para Picker)
    if (!document.getElementById('google-api-script')) {
      const script = document.createElement('script');
      script.id = 'google-api-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        gapi.load('picker', () => {
          this.pickerApiLoaded = true;
          this.secureLog('Google Picker API carregada');
        });
      };
      document.head.appendChild(script);
    }
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
      this.secureLog('Google: Inicializando com escopos:', this.SCOPES);
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            this.accessToken = response.access_token;
            this.isAuthenticated.set(true);
            this.fetchUserInfo().then(() => this.saveToStorage());
            this.secureLog('Google: Login bem sucedido!');
            this.secureLog('Google: Escopos CONCEDIDOS:', response.scope);
          } else if (response.error) {
            console.error('Google: Erro no login:', response.error, response);
            this.error.set(`Erro no login: ${response.error}`);
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
        this.secureLog('Google Photos: Token revogado');
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
    this.error.set(null);
    this.secureLog('Google Drive: Buscando pastas...');
    
    try {
      // Usando Google Drive API - buscar apenas pastas reais (não arquivos compactados)
      const response = await this.authenticatedFetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&pageSize=100&fields=files(id,name,thumbnailLink,iconLink,mimeType)&orderBy=name"
      );
      
      this.secureLog('Google Drive: Status pastas:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        this.secureLog('Google Drive: Dados pastas:', data);
        
        // Filtrar apenas pastas reais (excluir qualquer coisa com extensão de arquivo compactado no nome)
        const compressedExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'];
        
        const albums = (data.files || [])
          .filter((folder: any) => {
            const name = folder.name.toLowerCase();
            // Excluir se o nome terminar com extensão de arquivo compactado
            return !compressedExtensions.some(ext => name.endsWith(ext));
          })
          .map((folder: any) => ({
            id: folder.id,
            title: folder.name,
            coverPhotoBaseUrl: folder.thumbnailLink || folder.iconLink || '',
            mediaItemsCount: '?'
          }));
        
        this.albums.set(albums);
        this.secureLog('Google Drive: Pastas carregadas:', albums.length);
        
        if (albums.length === 0) {
          this.error.set('Nenhuma pasta encontrada. Verifique se você tem pastas no Google Drive.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Google Drive: Erro ao buscar pastas:', response.status, errorData);
        this.error.set(`Erro ao carregar pastas: ${errorData.error?.message || response.status}`);
      }
    } catch (error) {
      console.error('Erro ao buscar pastas:', error);
      this.error.set('Erro de conexão');
    } finally {
      this.isLoading.set(false);
    }
  }

  async fetchPhotosFromAlbum(albumId: string): Promise<void> {
    if (!this.accessToken) return;
    
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      // Usando Google Drive API - buscar APENAS imagens de uma pasta (não na lixeira)
      // Filtra por tipos de imagem específicos: jpeg, png, gif, webp, bmp, svg
      const imageQuery = `'${albumId}' in parents and trashed=false and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/gif' or mimeType='image/webp' or mimeType='image/bmp' or mimeType='image/svg+xml' or mimeType='image/heic' or mimeType='image/heif')`;
      
      const response = await this.authenticatedFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(imageQuery)}&pageSize=100&fields=files(id,name,mimeType,thumbnailLink,imageMediaMetadata)&orderBy=name`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Filtro adicional para garantir que são apenas imagens
        const photos = (data.files || [])
          .filter((file: any) => file.mimeType?.startsWith('image/'))
          .map((file: any) => ({
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
        this.secureLog('Google Drive: Imagens da pasta carregadas:', photos.length);
        
        if (photos.length === 0) {
          this.error.set('Nenhuma imagem encontrada nesta pasta.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Google Drive: Erro ao buscar imagens da pasta:', errorData);
        this.error.set('Erro ao carregar imagens da pasta');
      }
    } catch (error) {
      console.error('Erro ao buscar imagens da pasta:', error);
      this.error.set('Erro de conexão');
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
    this.secureLog('Google Drive: Buscando todas as imagens...');
    
    try {
      // Usando Google Drive API - buscar APENAS imagens (tipos específicos, não na lixeira)
      const imageQuery = "trashed=false and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/gif' or mimeType='image/webp' or mimeType='image/bmp' or mimeType='image/svg+xml' or mimeType='image/heic' or mimeType='image/heif')";
      
      const response = await this.authenticatedFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(imageQuery)}&pageSize=100&fields=files(id,name,mimeType,thumbnailLink,imageMediaMetadata)&orderBy=modifiedTime+desc`
      );
      
      this.secureLog('Google Drive: Status da resposta:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        this.secureLog('Google Drive: Dados recebidos:', data);
        
        // Filtro adicional para garantir que são apenas imagens
        const photos = (data.files || [])
          .filter((file: any) => file.mimeType?.startsWith('image/'))
          .map((file: any) => ({
            id: file.id,
            baseUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
            filename: file.name,
            mimeType: file.mimeType,
            width: file.imageMediaMetadata?.width || 800,
            height: file.imageMediaMetadata?.height || 600,
            selected: false,
            thumbnailLink: file.thumbnailLink
          }));
        
        this.secureLog('Google Drive: Total de imagens encontradas:', photos.length);
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

  // ===== Google Picker - Selecionar fotos visualmente =====
  
  async openPhotoPicker(): Promise<GooglePhoto[]> {
    return new Promise((resolve, reject) => {
      if (!this.accessToken) {
        reject(new Error('Não autenticado'));
        return;
      }

      if (!this.pickerApiLoaded || typeof google === 'undefined' || !google.picker) {
        reject(new Error('Google Picker não carregado'));
        return;
      }

      const view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES);
      view.setIncludeFolders(true);
      view.setSelectFolderEnabled(false);
      
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .addView(new google.picker.DocsView(google.picker.ViewId.PHOTOS))
        .setOAuthToken(this.accessToken)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const photos: GooglePhoto[] = data.docs.map((doc: any) => ({
              id: doc.id,
              baseUrl: `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
              filename: doc.name,
              mimeType: doc.mimeType,
              width: doc.sizeBytes ? 800 : 800,
              height: doc.sizeBytes ? 600 : 600,
              selected: true,
              thumbnailLink: doc.thumbnails?.[0]?.url || doc.iconUrl
            }));
            resolve(photos);
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve([]);
          }
        })
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setTitle('Selecione as fotos')
        .build();
      
      picker.setVisible(true);
    });
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
    // Usar a API do Google Drive para baixar o arquivo
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`;
    
    try {
      const response = await this.authenticatedFetch(downloadUrl);
      
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
