import { Injectable, signal, computed, inject } from '@angular/core';
import { createClient, SupabaseClient, User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { SecurityService } from './security.service';

export interface SupabaseProject {
  id: string;
  user_id: string;
  name: string;
  thumbnail: string | null;
  slides: any[];
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private security = inject(SecurityService);
  
  // Signals para estado reativo
  private userSignal = signal<User | null>(null);
  private loadingSignal = signal<boolean>(true);
  private errorSignal = signal<string | null>(null);
  
  // Controle de tentativas de login (proteção contra brute force)
  private loginAttempts = 0;
  private lastLoginAttempt = 0;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

  // Computed signals públicos
  user = this.userSignal.asReadonly();
  isAuthenticated = computed(() => !!this.userSignal());
  isLoading = this.loadingSignal.asReadonly();
  error = this.errorSignal.asReadonly();

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );

    // Escutar mudanças de autenticação
    this.supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      this.userSignal.set(session?.user ?? null);
      this.loadingSignal.set(false);
      
      // Resetar tentativas de login após sucesso
      if (event === 'SIGNED_IN') {
        this.loginAttempts = 0;
      }
    });

    // Verificar sessão existente
    this.checkSession();
  }

  /**
   * Verifica se o usuário está bloqueado por muitas tentativas de login
   */
  private isLockedOut(): boolean {
    if (this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - this.lastLoginAttempt;
      if (timeSinceLastAttempt < this.LOCKOUT_DURATION_MS) {
        return true;
      }
      // Resetar após período de bloqueio
      this.loginAttempts = 0;
    }
    return false;
  }

  /**
   * Registra tentativa de login
   */
  private recordLoginAttempt(): void {
    this.loginAttempts++;
    this.lastLoginAttempt = Date.now();
  }

  private async checkSession(): Promise<void> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.userSignal.set(session?.user ?? null);
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // ==================== AUTENTICAÇÃO ====================

  async signInWithGoogle(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
        }
      });

      if (error) throw error;
    } catch (error: any) {
      this.errorSignal.set(error.message || 'Erro ao fazer login com Google');
      this.loadingSignal.set(false);
      throw error;
    }
  }
  
  /**
   * Retorna o token de acesso do provedor Google (para uso com Google Drive)
   */
  async getGoogleAccessToken(): Promise<string | null> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session?.provider_token ?? null;
    } catch {
      return null;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    // Verificar bloqueio por tentativas excessivas
    if (this.isLockedOut()) {
      const remainingTime = Math.ceil((this.LOCKOUT_DURATION_MS - (Date.now() - this.lastLoginAttempt)) / 60000);
      this.errorSignal.set(`Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.`);
      throw new Error('Conta temporariamente bloqueada');
    }
    
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.errorSignal.set('Email inválido');
      throw new Error('Email inválido');
    }
    
    // Sanitizar inputs
    const sanitizedEmail = this.security.sanitize(email.toLowerCase().trim());
    
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const { error } = await this.supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password
      });

      if (error) {
        this.recordLoginAttempt();
        throw error;
      }
      
      // Login bem-sucedido - resetar tentativas
      this.loginAttempts = 0;
    } catch (error: any) {
      this.errorSignal.set(error.message || 'Erro ao fazer login');
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async signUpWithEmail(email: string, password: string): Promise<void> {
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.errorSignal.set('Email inválido');
      throw new Error('Email inválido');
    }
    
    // Validar força da senha
    const passwordValidation = this.security.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      this.errorSignal.set('Senha fraca: ' + passwordValidation.feedback.join(', '));
      throw new Error('Senha não atende aos requisitos de segurança');
    }
    
    // Sanitizar email
    const sanitizedEmail = this.security.sanitize(email.toLowerCase().trim());
    
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const { error } = await this.supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (error: any) {
      this.errorSignal.set(error.message || 'Erro ao criar conta');
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
      this.userSignal.set(null);
      
      // Limpar dados seguros
      this.security.clearAllSecureData();
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.errorSignal.set('Email inválido');
      throw new Error('Email inválido');
    }
    
    this.errorSignal.set(null);

    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(
        this.security.sanitize(email.toLowerCase().trim()), 
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      );

      if (error) throw error;
    } catch (error: any) {
      this.errorSignal.set(error.message || 'Erro ao enviar email de recuperação');
      throw error;
    }
  }

  // ==================== PROJETOS ====================

  async getProjects(): Promise<SupabaseProject[]> {
    const user = this.userSignal();
    if (!user) return [];

    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Erro ao buscar projetos:', error);
      this.errorSignal.set(error.message);
      return [];
    }
  }

  async getProject(projectId: string): Promise<SupabaseProject | null> {
    const user = this.userSignal();
    if (!user) return null;
    
    // Validar formato do ID
    if (!projectId || typeof projectId !== 'string') return null;
    
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id) // Garantir que o projeto pertence ao usuário
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      // Não expor detalhes do erro
      if (!environment.production) {
        console.error('Erro ao buscar projeto:', error);
      }
      return null;
    }
  }

  async createProject(name: string, slides: any[]): Promise<SupabaseProject | null> {
    const user = this.userSignal();
    if (!user) {
      this.errorSignal.set('Usuário não autenticado');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name,
          slides,
          thumbnail: null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Erro ao criar projeto:', error);
      this.errorSignal.set(error.message);
      return null;
    }
  }

  async updateProject(projectId: string, updates: Partial<Pick<SupabaseProject, 'name' | 'slides' | 'thumbnail'>>): Promise<boolean> {
    const user = this.userSignal();
    if (!user) {
      this.errorSignal.set('Usuário não autenticado');
      return false;
    }
    
    // Validar formato do ID
    if (!projectId || typeof projectId !== 'string') return false;
    
    // Sanitizar nome se presente
    if (updates.name) {
      updates.name = this.security.sanitize(updates.name);
    }
    
    try {
      const { error } = await this.supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('user_id', user.id); // Garantir que o projeto pertence ao usuário

      if (error) throw error;
      return true;
    } catch (error: any) {
      if (!environment.production) {
        console.error('Erro ao atualizar projeto:', error);
      }
      this.errorSignal.set('Erro ao atualizar projeto');
      return false;
    }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const user = this.userSignal();
    if (!user) {
      this.errorSignal.set('Usuário não autenticado');
      return false;
    }
    
    // Validar formato do ID
    if (!projectId || typeof projectId !== 'string') return false;
    
    try {
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id); // Garantir que o projeto pertence ao usuário

      if (error) throw error;
      return true;
    } catch (error: any) {
      if (!environment.production) {
        console.error('Erro ao deletar projeto:', error);
      }
      this.errorSignal.set('Erro ao deletar projeto');
      return false;
    }
  }

  // ==================== STORAGE (IMAGENS) ====================

  async uploadImage(file: File, projectId: string): Promise<string | null> {
    const user = this.userSignal();
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${projectId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await this.supabase.storage
        .from('project-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data } = this.supabase.storage
        .from('project-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload de imagem:', error);
      this.errorSignal.set(error.message);
      return null;
    }
  }

  async uploadImageFromBase64(base64: string, projectId: string, fileName: string): Promise<string | null> {
    const user = this.userSignal();
    if (!user) return null;

    try {
      // Converter base64 para blob
      const response = await fetch(base64);
      const blob = await response.blob();

      const fileExt = fileName.split('.').pop() || 'png';
      const path = `${user.id}/${projectId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await this.supabase.storage
        .from('project-images')
        .upload(path, blob);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data } = this.supabase.storage
        .from('project-images')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload de imagem base64:', error);
      return null;
    }
  }

  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      // Extrair o path da URL
      const url = new URL(imageUrl);
      const path = url.pathname.split('/project-images/')[1];
      
      if (!path) return false;

      const { error } = await this.supabase.storage
        .from('project-images')
        .remove([path]);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Erro ao deletar imagem:', error);
      return false;
    }
  }

  // Limpar erro
  clearError(): void {
    this.errorSignal.set(null);
  }

  // Obter informações do usuário
  getUserInfo() {
    const user = this.userSignal();
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.['full_name'] || user.user_metadata?.['name'] || user.email?.split('@')[0],
      picture: user.user_metadata?.['avatar_url'] || user.user_metadata?.['picture']
    };
  }
}
