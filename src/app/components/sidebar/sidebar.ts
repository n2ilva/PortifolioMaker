import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { SlideService } from '../../services/slide.service';
import { LayoutTemplate, AnimationType, ElementAnimation } from '../../models/slide.model';
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
  
  // Grade personalizada (controles inline)
  customGridColumns = 2;
  customGridRows = 2;
  customGridGap = 2; // espaçamento entre células em porcentagem
  customGridMarginX = 2; // margem horizontal em porcentagem
  customGridMarginY = 2; // margem vertical em porcentagem
  
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
      id: 'planetaterra',
      name: 'Planeta Terra',
      preview: 'assets/planetaterra.jpeg',
      description: 'Nosso planeta',
      isCustomImage: true,
      imageData: 'assets/planetaterra.jpeg'
    },
    {
      id: 'infantil_escolar',
      name: 'Escolar',
      preview: 'assets/infantil_escolar.png',
      description: 'Tema escolar infantil',
      isCustomImage: true,
      imageData: 'assets/infantil_escolar.png'
    },
    {
      id: 'infantil_quadronegro',
      name: 'Quadro Negro',
      preview: 'assets/infantil_quadronegro.png',
      description: 'Estilo lousa escolar',
      isCustomImage: true,
      imageData: 'assets/infantil_quadronegro.png'
    },
    {
      id: 'infantil_sol',
      name: 'Sol',
      preview: 'assets/infantil_sol.png',
      description: 'Tema solar infantil',
      isCustomImage: true,
      imageData: 'assets/infantil_sol.png'
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

  // Proporções de imagem padrão
  aspectRatios = [
    { name: '1:1', value: 1, icon: '□' },
    { name: '4:5', value: 4/5, icon: '▯' },
    { name: '2:3', value: 2/3, icon: '▯' },
    { name: '3:4', value: 3/4, icon: '▯' },
    { name: '3:2', value: 3/2, icon: '▭' },
    { name: '4:3', value: 4/3, icon: '▭' },
    { name: '16:9', value: 16/9, icon: '▬' },
    { name: '9:16', value: 9/16, icon: '▮' },
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

  applyCustomGrid(): void {
    const guides = this.generateGridGuides(
      this.customGridColumns, 
      this.customGridRows, 
      this.customGridGap,
      this.customGridMarginX,
      this.customGridMarginY
    );
    this.slideService.applyCustomLayout(guides);
  }

  generateGridGuides(
    cols: number, 
    rows: number, 
    gap: number,
    marginX: number = 2,
    marginY: number = 2
  ): { x: number; y: number; width: number; height: number; label: string }[] {
    const guides: { x: number; y: number; width: number; height: number; label: string }[] = [];
    
    // Área disponível após margens
    const totalWidth = 100 - (marginX * 2);
    const totalHeight = 100 - (marginY * 2);
    
    // Calcular tamanho de cada célula
    const cellWidth = (totalWidth - (gap * (cols - 1))) / cols;
    const cellHeight = (totalHeight - (gap * (rows - 1))) / rows;
    
    let count = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = marginX + (col * (cellWidth + gap));
        const y = marginY + (row * (cellHeight + gap));
        
        guides.push({
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          label: `${count}`
        });
        count++;
      }
    }
    
    return guides;
  }

  // Preview da grade personalizada
  getPreviewGridStyle(): { [key: string]: string } {
    return {
      'grid-template-columns': `repeat(${this.customGridColumns}, 1fr)`,
      'grid-template-rows': `repeat(${this.customGridRows}, 1fr)`,
      'gap': `${this.customGridGap}%`,
      'padding': `${this.customGridMarginY}% ${this.customGridMarginX}%`
    };
  }

  // Métodos para ajustar colunas e linhas
  decreaseColumns(): void {
    if (this.customGridColumns > 1) {
      this.customGridColumns--;
    }
  }

  increaseColumns(): void {
    if (this.customGridColumns < 6) {
      this.customGridColumns++;
    }
  }

  decreaseRows(): void {
    if (this.customGridRows > 1) {
      this.customGridRows--;
    }
  }

  increaseRows(): void {
    if (this.customGridRows < 6) {
      this.customGridRows++;
    }
  }

  // Array para preview de células
  getPreviewCells(): number[] {
    return Array(this.customGridColumns * this.customGridRows).fill(0).map((_, i) => i + 1);
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

  // Proporção do canvas (960x540 = 16:9)
  private canvasAspectRatio = 960 / 540; // 1.7778

  onAspectRatioChange(ratio: number): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      // O canvas tem proporção 16:9 (960x540)
      // Quando usamos porcentagens, precisamos compensar a diferença
      // Para que a imagem apareça com a proporção correta visualmente
      
      const currentHeight = element.position.height;
      const currentWidth = element.position.width;
      
      // Calcula a nova largura levando em conta a proporção do canvas
      // newWidth% / currentHeight% * canvasAspectRatio = ratio desejado
      // newWidth% = currentHeight% * ratio / canvasAspectRatio
      let newWidth = currentHeight * ratio / this.canvasAspectRatio;
      let newHeight = currentHeight;
      
      // Se a nova largura for muito grande, ajusta baseado na largura
      if (newWidth > 85) {
        newWidth = 70;
        // newHeight% = newWidth% * canvasAspectRatio / ratio
        newHeight = newWidth * this.canvasAspectRatio / ratio;
      }
      
      // Se a nova altura for muito grande, ajusta também
      if (newHeight > 85) {
        newHeight = 70;
        newWidth = newHeight * ratio / this.canvasAspectRatio;
      }
      
      this.slideService.updateElement(element.id, {
        position: {
          ...element.position,
          width: newWidth,
          height: newHeight
        }
      });
    }
  }

  getCurrentAspectRatio(): string | null {
    const element = this.selectedElement;
    if (!element || !this.isImageElement(element)) return null;
    
    const { width, height } = element.position;
    // Calcula a proporção visual real (compensando a proporção do canvas)
    const visualRatio = (width / height) * this.canvasAspectRatio;
    
    // Encontra a proporção mais próxima
    for (const ar of this.aspectRatios) {
      if (Math.abs(visualRatio - ar.value) < 0.1) {
        return ar.name;
      }
    }
    return null;
  }

  getLayoutIcon(layout: LayoutTemplate): string {
    const icons: { [key: string]: string } = {
      'layout-3-images': '▣▣▣',
      'layout-2-images': '◧◨',
      'layout-1-image': '▣',
      'layout-4-images-grid': '▦',
      'layout-6-images-grid': '⬡',
      'layout-custom': '⊞'
    };
    return icons[layout.id] || '▢';
  }

  // Métodos para controle de borda arredondada de imagens
  getBorderRadius(): number {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      return element.border?.radius ?? 0;
    }
    return 0;
  }

  isCircular(): boolean {
    return this.getBorderRadius() >= 200;
  }

  onBorderRadiusPreset(value: number): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      this.slideService.updateElementBorder(element.id, { radius: value });
    }
  }

  onBorderRadiusSlider(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      this.slideService.updateElementBorder(element.id, { radius: value });
    }
  }

  // Métodos para controle de sombra de imagens
  isShadowEnabled(): boolean {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      return element.shadow?.enabled ?? false;
    }
    return false;
  }

  getShadowBlur(): number {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      return element.shadow?.blur ?? 15;
    }
    return 15;
  }

  getShadowColor(): string {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      return element.shadow?.color ?? 'rgba(0,0,0,0.3)';
    }
    return 'rgba(0,0,0,0.3)';
  }

  getShadowDirection(): string {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      const x = element.shadow?.x ?? 4;
      const y = element.shadow?.y ?? 4;
      
      if (x === 0 && y === 0) return 'center';
      if (x < 0 && y < 0) return 'top-left';
      if (x === 0 && y < 0) return 'top';
      if (x > 0 && y < 0) return 'top-right';
      if (x < 0 && y === 0) return 'left';
      if (x > 0 && y === 0) return 'right';
      if (x < 0 && y > 0) return 'bottom-left';
      if (x === 0 && y > 0) return 'bottom';
      if (x > 0 && y > 0) return 'bottom-right';
    }
    return 'bottom-right';
  }

  setShadowPreset(preset: 'none' | 'soft' | 'medium' | 'strong'): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      switch (preset) {
        case 'none':
          this.slideService.updateElementShadow(element.id, { enabled: false });
          break;
        case 'soft':
          this.slideService.updateElementShadow(element.id, { 
            enabled: true, x: 2, y: 2, blur: 8, color: 'rgba(0,0,0,0.2)' 
          });
          break;
        case 'medium':
          this.slideService.updateElementShadow(element.id, { 
            enabled: true, x: 4, y: 4, blur: 15, color: 'rgba(0,0,0,0.3)' 
          });
          break;
        case 'strong':
          this.slideService.updateElementShadow(element.id, { 
            enabled: true, x: 6, y: 6, blur: 30, color: 'rgba(0,0,0,0.4)' 
          });
          break;
      }
    }
  }

  onShadowBlurChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      this.slideService.updateElementShadow(element.id, { blur: value });
    }
  }

  setShadowDirection(direction: string): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      const offset = 4;
      let x = 0, y = 0;
      
      switch (direction) {
        case 'top-left': x = -offset; y = -offset; break;
        case 'top': x = 0; y = -offset; break;
        case 'top-right': x = offset; y = -offset; break;
        case 'left': x = -offset; y = 0; break;
        case 'center': x = 0; y = 0; break;
        case 'right': x = offset; y = 0; break;
        case 'bottom-left': x = -offset; y = offset; break;
        case 'bottom': x = 0; y = offset; break;
        case 'bottom-right': x = offset; y = offset; break;
      }
      
      this.slideService.updateElementShadow(element.id, { x, y });
    }
  }

  setShadowColor(color: string): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      this.slideService.updateElementShadow(element.id, { color });
    }
  }

  toggleImageShadow(): void {
    const element = this.selectedElement;
    if (element && this.isImageElement(element)) {
      const currentShadow = element.shadow?.enabled ?? false;
      this.slideService.updateElementShadow(element.id, { enabled: !currentShadow });
    }
  }

  onDeleteElement(): void {
    const element = this.selectedElement;
    if (element) {
      this.slideService.deleteElement(element.id);
    }
  }

  // ============== Métodos de Animação ==============
  
  getAnimationType(): string {
    const element = this.selectedElement;
    return element?.animation?.type || 'none';
  }

  onAnimationTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AnimationType;
    const element = this.selectedElement;
    if (element) {
      if (value === 'none') {
        // Remover animação completamente
        this.slideService.updateElement(element.id, { animation: undefined } as any);
      } else {
        // Criar ou atualizar animação
        const newAnimation: ElementAnimation = {
          type: value,
          duration: element.animation?.duration ?? 0.5,
          delay: element.animation?.delay ?? 0,
          easing: element.animation?.easing ?? 'ease',
          repeat: element.animation?.repeat ?? false
        };
        this.slideService.updateElement(element.id, { animation: newAnimation });
      }
    }
  }

  getAnimationDuration(): number {
    const element = this.selectedElement;
    return element?.animation?.duration || 0.5;
  }

  onAnimationDurationChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    const element = this.selectedElement;
    if (element && element.animation) {
      this.slideService.updateElement(element.id, { 
        animation: { ...element.animation, duration: value }
      });
    }
  }

  getAnimationDelay(): number {
    const element = this.selectedElement;
    return element?.animation?.delay || 0;
  }

  onAnimationDelayChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    const element = this.selectedElement;
    if (element && element.animation) {
      this.slideService.updateElement(element.id, { 
        animation: { ...element.animation, delay: value }
      });
    }
  }

  getAnimationEasing(): string {
    const element = this.selectedElement;
    return element?.animation?.easing || 'ease';
  }

  onAnimationEasingChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
    const element = this.selectedElement;
    if (element && element.animation) {
      this.slideService.updateElement(element.id, { 
        animation: { ...element.animation, easing: value }
      });
    }
  }

  getAnimationRepeat(): boolean {
    const element = this.selectedElement;
    return element?.animation?.repeat || false;
  }

  onAnimationRepeatChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const element = this.selectedElement;
    if (element && element.animation) {
      this.slideService.updateElement(element.id, { 
        animation: { ...element.animation, repeat: checked }
      });
    }
  }

  previewAnimation(): void {
    const element = this.selectedElement;
    if (element && element.animation) {
      // Dispara um evento customizado para preview de animação
      const event = new CustomEvent('preview-animation', { 
        detail: { elementId: element.id, animation: element.animation }
      });
      document.dispatchEvent(event);
    }
  }
}
