import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { SlideService } from '../../services/slide.service';
import { LayoutTemplate } from '../../models/slide.model';
import { ImageElement, TextElement } from '../../models/slide.model';

interface BackgroundTheme {
  id: string;
  name: string;
  preview: string; // Gradiente, cor ou imagem base64 para prévia
  description: string;
  isCustomImage?: boolean; // Se for uma imagem personalizada
  imageData?: string; // Base64 da imagem completa ou caminho do asset
  isUserAdded?: boolean; // Se foi adicionado pelo usuário (pode ser removido)
}

// Chave para localStorage dos temas personalizados
const CUSTOM_THEMES_KEY = 'portifolio-maker-custom-themes';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  slideService = inject(SlideService);
  private sanitizer = inject(DomSanitizer);
  
  activeTab: 'layouts' | 'element' | 'slide' = 'layouts';
  applyThemeToAllSlides = false;
  lastSelectedTheme: string | null = null;
  
  // Modal de adicionar imagem personalizada
  showAddImageModal = false;
  newImageName = '';
  newImageDescription = '';
  newImagePreview = '';
  newImageData = '';
  
  // Abas de seleção de cor
  textColorTab: 'palette' | 'custom' = 'palette';
  bgColorTab: 'palette' | 'custom' = 'palette';

  // Temas de fundo padrão
  private defaultThemes: BackgroundTheme[] = [
    {
      id: 'none',
      name: 'Nenhuma',
      preview: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      description: 'Sem imagem de fundo'
    },
    {
      id: 'cristal',
      name: 'Cristal',
      preview: 'assets/cristal.jpeg',
      description: 'Fundo cristalino',
      isCustomImage: true,
      imageData: 'assets/cristal.jpeg'
    },
    {
      id: 'natal',
      name: 'Natal',
      preview: 'assets/natal.jpeg',
      description: 'Tema natalino',
      isCustomImage: true,
      imageData: 'assets/natal.jpeg'
    },
    {
      id: 'planetaterra',
      name: 'Planeta Terra',
      preview: 'assets/planetaterra.jpeg',
      description: 'Nosso planeta',
      isCustomImage: true,
      imageData: 'assets/planetaterra.jpeg'
    },
    {
      id: 'tinta',
      name: 'Tinta',
      preview: 'assets/tinta.jpeg',
      description: 'Arte com tintas',
      isCustomImage: true,
      imageData: 'assets/tinta.jpeg'
    }
  ];

  // Lista combinada de temas (padrão + personalizados)
  backgroundThemes: BackgroundTheme[] = [];

  constructor() {
    this.loadCustomThemes();
  }

  // Carregar temas personalizados do localStorage
  private loadCustomThemes(): void {
    try {
      const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
      const customThemes: BackgroundTheme[] = stored ? JSON.parse(stored) : [];
      this.backgroundThemes = [...this.defaultThemes, ...customThemes];
    } catch (error) {
      console.warn('Erro ao carregar temas personalizados:', error);
      this.backgroundThemes = [...this.defaultThemes];
    }
  }

  // Salvar temas personalizados no localStorage
  private saveCustomThemes(): void {
    try {
      const customThemes = this.backgroundThemes.filter(t => t.isUserAdded);
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
    } catch (error) {
      console.warn('Erro ao salvar temas personalizados:', error);
    }
  }

  // Lista de fontes disponíveis
  fontList = [
    // Sans-serif (modernas e limpas)
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Helvetica Neue', value: "'Helvetica Neue', Arial, sans-serif" },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
    { name: 'Tahoma', value: 'Tahoma, sans-serif' },
    
    // Serif (clássicas e elegantes)
    { name: 'Times New Roman', value: "'Times New Roman', serif" },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
    { name: 'Garamond', value: 'Garamond, serif' },
    
    // Monospace (código/técnico)
    { name: 'Courier New', value: "'Courier New', monospace" },
    { name: 'Consolas', value: 'Consolas, monospace' },
    { name: 'Monaco', value: 'Monaco, monospace' },
    
    // Google Fonts (decorativas/modernas)
    { name: 'Montserrat', value: "'Montserrat', sans-serif" },
    { name: 'Poppins', value: "'Poppins', sans-serif" },
    { name: 'Roboto', value: "'Roboto', sans-serif" },
    { name: 'Open Sans', value: "'Open Sans', sans-serif" },
    { name: 'Lato', value: "'Lato', sans-serif" },
    { name: 'Oswald', value: "'Oswald', sans-serif" },
    { name: 'Raleway', value: "'Raleway', sans-serif" },
    { name: 'Playfair Display', value: "'Playfair Display', serif" },
    { name: 'Merriweather', value: "'Merriweather', serif" },
    
    // Fontes divertidas/infantis
    { name: 'Comic Sans MS', value: "'Comic Sans MS', cursive" },
    { name: 'Pacifico', value: "'Pacifico', cursive" },
    { name: 'Lobster', value: "'Lobster', cursive" },
    { name: 'Fredoka One', value: "'Fredoka One', cursive" },
    { name: 'Bubblegum Sans', value: "'Bubblegum Sans', cursive" },
    
    // Fontes manuscritas/elegantes
    { name: 'Dancing Script', value: "'Dancing Script', cursive" },
    { name: 'Great Vibes', value: "'Great Vibes', cursive" },
    { name: 'Satisfy', value: "'Satisfy', cursive" }
  ];

  // Paleta de cores escolares/educacionais
  schoolColorPalette = [
    // Cores primárias vibrantes (crianças)
    { name: 'Vermelho Escolar', value: '#E53935' },
    { name: 'Azul Royal', value: '#1E88E5' },
    { name: 'Amarelo Sol', value: '#FDD835' },
    { name: 'Verde Quadro', value: '#43A047' },
    { name: 'Laranja', value: '#FB8C00' },
    { name: 'Roxo', value: '#8E24AA' },
    
    // Cores suaves/pastéis (infantil)
    { name: 'Rosa Pastel', value: '#F8BBD9' },
    { name: 'Azul Pastel', value: '#BBDEFB' },
    { name: 'Verde Pastel', value: '#C8E6C9' },
    { name: 'Amarelo Pastel', value: '#FFF9C4' },
    { name: 'Lavanda', value: '#E1BEE7' },
    { name: 'Pêssego', value: '#FFCCBC' },
    
    // Cores institucionais (ensino médio/faculdade)
    { name: 'Azul Marinho', value: '#1A237E' },
    { name: 'Bordô', value: '#880E4F' },
    { name: 'Verde Escuro', value: '#1B5E20' },
    { name: 'Cinza Grafite', value: '#37474F' },
    
    // Neutros
    { name: 'Preto', value: '#212121' },
    { name: 'Cinza', value: '#757575' },
    { name: 'Branco', value: '#FFFFFF' },
    { name: 'Creme', value: '#FFFDE7' },
  ];

  setActiveTab(tab: 'layouts' | 'element' | 'slide'): void {
    this.activeTab = tab;
  }

  onApplyLayout(layout: LayoutTemplate): void {
    this.slideService.applyLayout(layout.id);
  }

  onBackgroundColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.slideService.updateSlideBackground(input.value);
  }

  onApplyBackgroundTheme(theme: 'none' | 'clean-sky' | 'classroom' | 'chalkboard' | 'soccer-field', applyToAll: boolean): void {
    this.lastSelectedTheme = theme;
    this.slideService.applyBackgroundTheme(theme, applyToAll ? 'all' : 'current');
  }

  onSelectBackgroundTheme(theme: BackgroundTheme): void {
    this.lastSelectedTheme = theme.id;
    
    // Se for imagem personalizada, aplica a imagem
    if (theme.isCustomImage && theme.imageData) {
      this.slideService.applyBackgroundImage(theme.imageData, 'current');
    } else {
      this.slideService.applyBackgroundTheme(theme.id as any, 'current');
    }
  }

  onApplyBackgroundThemeToAll(): void {
    if (!this.lastSelectedTheme) return;
    
    const theme = this.backgroundThemes.find(t => t.id === this.lastSelectedTheme);
    if (theme?.isCustomImage && theme.imageData) {
      this.slideService.applyBackgroundImage(theme.imageData, 'all');
    } else {
      this.slideService.applyBackgroundTheme(this.lastSelectedTheme as any, 'all');
    }
  }

  // Modal de adicionar imagem personalizada
  openAddImageModal(): void {
    this.showAddImageModal = true;
    this.newImageName = '';
    this.newImageDescription = '';
    this.newImagePreview = '';
    this.newImageData = '';
  }

  closeAddImageModal(): void {
    this.showAddImageModal = false;
  }

  onNewImageFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.newImageData = base64;
      this.newImagePreview = base64;
    };
    reader.readAsDataURL(file);
  }

  confirmAddImage(): void {
    if (!this.newImageName.trim() || !this.newImageData) return;

    const newTheme: BackgroundTheme = {
      id: `custom-${Date.now()}`,
      name: this.newImageName.trim(),
      preview: this.newImagePreview,
      description: this.newImageDescription.trim() || 'Imagem personalizada',
      isCustomImage: true,
      imageData: this.newImageData,
      isUserAdded: true
    };

    this.backgroundThemes.push(newTheme);
    this.saveCustomThemes(); // Salvar após adicionar
    this.closeAddImageModal();
  }

  removeCustomTheme(theme: BackgroundTheme, event: Event): void {
    event.stopPropagation();
    if (!theme.isUserAdded) return; // Só remove temas adicionados pelo usuário
    const index = this.backgroundThemes.findIndex(t => t.id === theme.id);
    if (index > -1) {
      this.backgroundThemes.splice(index, 1);
      this.saveCustomThemes(); // Salvar após remover
      if (this.lastSelectedTheme === theme.id) {
        this.lastSelectedTheme = null;
      }
    }
  }

  isThemeSelected(themeId: string): boolean {
    return this.lastSelectedTheme === themeId;
  }

  getThemePreviewStyle(theme: BackgroundTheme): SafeStyle {
    if (theme.isCustomImage) {
      return this.sanitizer.bypassSecurityTrustStyle(`url('${theme.preview}') center/cover no-repeat`);
    }
    return this.sanitizer.bypassSecurityTrustStyle(theme.preview);
  }

  onSlideNameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.slideService.updateCurrentSlideName(input.value);
  }

  // Métodos para edição de elemento selecionado
  get selectedElement() {
    return this.slideService.selectedElement();
  }

  isImageElement(element: ImageElement | TextElement | null): element is ImageElement {
    return element?.type === 'image';
  }

  isTextElement(element: ImageElement | TextElement | null): element is TextElement {
    return element?.type === 'text';
  }

  onFontSizeChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const value = parseInt((event.target as HTMLInputElement).value, 10);
      this.slideService.updateElement(element.id, { fontSize: value });
    }
  }

  onTextColorChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const value = (event.target as HTMLInputElement).value;
      this.slideService.updateElement(element.id, { color: value });
    }
  }

  onTextColorSelect(color: string): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      this.slideService.updateElement(element.id, { color });
    }
  }

  onTextBackgroundSelect(color: string): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      this.slideService.updateElement(element.id, { backgroundColor: color });
    }
  }

  onTextAlignChange(align: 'left' | 'center' | 'right'): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      this.slideService.updateElement(element.id, { textAlign: align });
    }
  }

  onFontWeightChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const checked = (event.target as HTMLInputElement).checked;
      this.slideService.updateElement(element.id, { fontWeight: checked ? 'bold' : 'normal' });
    }
  }

  onFontStyleChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const checked = (event.target as HTMLInputElement).checked;
      this.slideService.updateElement(element.id, { fontStyle: checked ? 'italic' : 'normal' });
    }
  }

  onFontFamilyChange(fontFamily: string): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      this.slideService.updateElement(element.id, { fontFamily });
    }
  }

  onLineHeightChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const value = parseFloat((event.target as HTMLInputElement).value);
      this.slideService.updateElement(element.id, { lineHeight: value });
    }
  }

  onTextBackgroundColorChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const value = (event.target as HTMLInputElement).value;
      this.slideService.updateElement(element.id, { backgroundColor: value });
    }
  }

  onClearTextBackground(): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      this.slideService.updateElement(element.id, { backgroundColor: 'transparent' });
    }
  }

  onTextBorderRadiusChange(event: Event): void {
    const element = this.selectedElement;
    if (element && this.isTextElement(element)) {
      const value = parseInt((event.target as HTMLInputElement).value, 10);
      this.slideService.updateElementBorder(element.id, { radius: value });
    }
  }

  onImageFitChange(fit: 'cover' | 'contain' | 'fill'): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      this.slideService.updateElement(element.id, { fit });
    }
  }

  getLayoutIcon(layout: LayoutTemplate): string {
    const icons: { [key: string]: string } = {
      'layout-3-images-1-text': '▣▣▣',
      'layout-2-images-1-text': '◧◨',
      'layout-1-image-1-text': '◐◑',
      'layout-4-images-grid': '▦',
      'layout-text-only': '☰',
      'layout-custom': '◇'
    };
    return icons[layout.id] || '▢';
  }
}
