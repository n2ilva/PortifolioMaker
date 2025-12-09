import { Injectable, signal, computed, effect } from '@angular/core';
import { 
  Slide, 
  ImageElement, 
  TextElement, 
  LayoutTemplate,
  ElementPosition,
  AlignmentGuide,
  ElementBorderStyle,
  ElementShadow
} from '../models/slide.model';
import { LAYOUT_TEMPLATES } from '../models/layouts.data';

// Chave para localStorage
const STORAGE_KEY = 'portifolio-maker-data';

// Interface para dados persistidos
interface PersistedData {
  slides: Slide[];
  currentSlideId: string | null;
  version: number;
}

// Valores padrão para novos elementos
const DEFAULT_BORDER: ElementBorderStyle = {
  radius: 0,
  width: 0,
  color: '#000000',
  style: 'none'
};

const DEFAULT_SHADOW: ElementShadow = {
  enabled: false,
  x: 0,
  y: 4,
  blur: 8,
  color: 'rgba(0,0,0,0.3)'
};

@Injectable({
  providedIn: 'root'
})
export class SlideService {
  // Signals para estado reativo
  private slidesSignal = signal<Slide[]>([]);
  private currentSlideIdSignal = signal<string | null>(null);
  private selectedElementIdSignal = signal<string | null>(null);
  private zoomSignal = signal<number>(100);
  private alignmentGuidesSignal = signal<AlignmentGuide[]>([]);
  private hoveredElementIdSignal = signal<string | null>(null);

  // Computed values
  slides = computed(() => this.slidesSignal());
  currentSlideId = computed(() => this.currentSlideIdSignal());
  selectedElementId = computed(() => this.selectedElementIdSignal());
  zoom = computed(() => this.zoomSignal());
  alignmentGuides = computed(() => this.alignmentGuidesSignal());
  hoveredElementId = computed(() => this.hoveredElementIdSignal());
  
  currentSlide = computed(() => {
    const slides = this.slidesSignal();
    const currentId = this.currentSlideIdSignal();
    return slides.find(s => s.id === currentId) || null;
  });

  selectedElement = computed(() => {
    const slide = this.currentSlide();
    const elementId = this.selectedElementIdSignal();
    if (!slide || !elementId) return null;
    return slide.elements.find(e => e.id === elementId) || null;
  });

  layoutTemplates = LAYOUT_TEMPLATES;

  // Threshold para snap de alinhamento (em porcentagem)
  private readonly SNAP_THRESHOLD = 1.5;

  constructor() {
    // Tentar carregar dados salvos
    const loaded = this.loadFromStorage();
    
    if (!loaded) {
      // Se não há dados salvos, criar slide inicial
      this.createSlide('layout-3-images-1-text');
    }

    // Configurar auto-save quando os slides mudarem
    effect(() => {
      const slides = this.slidesSignal();
      const currentId = this.currentSlideIdSignal();
      // Salvar automaticamente quando houver mudanças
      this.saveToStorage();
    });
  }

  // Salvar dados no localStorage
  private saveToStorage(): void {
    try {
      const data: PersistedData = {
        slides: this.slidesSignal(),
        currentSlideId: this.currentSlideIdSignal(),
        version: 1
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Erro ao salvar dados:', error);
    }
  }

  // Carregar dados do localStorage
  private loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      const data: PersistedData = JSON.parse(stored);
      
      if (data.slides && data.slides.length > 0) {
        // Restaurar datas como objetos Date
        const slides = data.slides.map(slide => ({
          ...slide,
          createdAt: new Date(slide.createdAt),
          updatedAt: new Date(slide.updatedAt)
        }));
        
        this.slidesSignal.set(slides);
        this.currentSlideIdSignal.set(data.currentSlideId || slides[0].id);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Erro ao carregar dados:', error);
      return false;
    }
  }

  // Limpar todos os dados salvos (para reset)
  clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Atualizar nome do slide atual
  updateCurrentSlideName(name: string): void {
    const currentId = this.currentSlideIdSignal();
    if (!currentId) return;

    this.slidesSignal.update(slides =>
      slides.map(slide =>
        slide.id === currentId
          ? { ...slide, name, updatedAt: new Date() }
          : slide
      )
    );
  }

  // Aplicar temas de fundo que adicionam elementos "decorativos" redimensionáveis
  applyBackgroundTheme(
    theme: 'none' | 'clean-sky' | 'classroom' | 'chalkboard' | 'soccer-field',
    scope: 'current' | 'all' = 'current'
  ): void {
    const current = this.currentSlide();
    if (!current) return;

    this.slidesSignal.update(slides =>
      slides.map(s => {
        if (scope === 'current' && s.id !== current.id) return s;

        let elements = s.elements.filter(e => !e.metadata?.['backgroundDecor']);

        if (theme === 'clean-sky') {
          const width = 100;
          const height = 100;

          // Céu (retângulo azul grande)
          const sky: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 0, y: 0, width, height: 70 },
            zIndex: -100,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#87CEEB',
            metadata: { backgroundDecor: true, kind: 'sky' }
          } as any;

          // Grama (faixa verde embaixo)
          const grass: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 0, y: 70, width, height: 30 },
            zIndex: -99,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#228B22',
            metadata: { backgroundDecor: true, kind: 'grass' }
          } as any;

          // Sol (círculo amarelo)
          const sun: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 70, y: 5, width: 20, height: 20 },
            zIndex: -98,
            border: { ...DEFAULT_BORDER, radius: 999 },
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#FFD700',
            metadata: { backgroundDecor: true, kind: 'sun' }
          } as any;

          elements = [sky, grass, sun, ...elements];
        } else if (theme === 'classroom') {
          // Parede da sala
          const wall: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 0, y: 0, width: 100, height: 70 },
            zIndex: -100,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#f5f5f5',
            metadata: { backgroundDecor: true, kind: 'wall' }
          } as any;

          // Quadro verde
          const board: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 10, y: 15, width: 80, height: 35 },
            zIndex: -99,
            border: { ...DEFAULT_BORDER, width: 2, color: '#4b5563', style: 'solid' },
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#14532d',
            metadata: { backgroundDecor: true, kind: 'classroom-board' }
          } as any;

          // Mesa em frente ao quadro
          const desk: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 30, y: 55, width: 40, height: 12 },
            zIndex: -98,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#b45309',
            metadata: { backgroundDecor: true, kind: 'desk' }
          } as any;

          elements = [wall, board, desk, ...elements];
        } else if (theme === 'chalkboard') {
          // Fundo escuro de sala
          const darkWall: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 0, y: 0, width: 100, height: 100 },
            zIndex: -100,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#020617',
            metadata: { backgroundDecor: true, kind: 'dark-wall' }
          } as any;

          // Quadro negro central
          const chalkboard: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 8, y: 18, width: 84, height: 50 },
            zIndex: -99,
            border: { ...DEFAULT_BORDER, width: 3, color: '#9a3412', style: 'solid' },
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#020617',
            metadata: { backgroundDecor: true, kind: 'chalkboard' }
          } as any;

          elements = [darkWall, chalkboard, ...elements];
        } else if (theme === 'soccer-field') {
          // Gramado
          const field: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 0, y: 10, width: 100, height: 80 },
            zIndex: -100,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#15803d',
            metadata: { backgroundDecor: true, kind: 'field' }
          } as any;

          // Linha central
          const midLine: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 48, y: 10, width: 4, height: 80 },
            zIndex: -99,
            border: DEFAULT_BORDER,
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: '#e5e7eb',
            metadata: { backgroundDecor: true, kind: 'mid-line' }
          } as any;

          // Círculo central
          const centerCircle: TextElement = {
            id: this.generateId(),
            type: 'text',
            content: '',
            fontSize: 1,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            color: '#000000',
            textAlign: 'center',
            position: { x: 35, y: 35, width: 30, height: 30 },
            zIndex: -98,
            border: { ...DEFAULT_BORDER, width: 2, color: '#e5e7eb', style: 'solid' },
            shadow: DEFAULT_SHADOW,
            opacity: 1,
            rotation: 0,
            backgroundColor: 'transparent',
            metadata: { backgroundDecor: true, kind: 'center-circle' }
          } as any;

          elements = [field, midLine, centerCircle, ...elements];
        }

        return {
          ...s,
          elements,
          updatedAt: new Date()
        };
      })
    );
  }

  // Aplicar imagem de fundo personalizada
  applyBackgroundImage(
    imageData: string,
    scope: 'current' | 'all' = 'current'
  ): void {
    const current = this.currentSlide();
    if (!current) return;

    this.slidesSignal.update(slides =>
      slides.map(s => {
        if (scope === 'current' && s.id !== current.id) return s;

        // Remove elementos decorativos antigos
        let elements = s.elements.filter(e => !e.metadata?.['backgroundDecor']);

        // Incrementa o zIndex de todos os elementos existentes para ficarem acima do fundo
        elements = elements.map(e => ({
          ...e,
          zIndex: e.zIndex + 1
        }));

        // Adiciona imagem de fundo como elemento com zIndex 0
        const bgImage: ImageElement = {
          id: this.generateId(),
          type: 'image',
          src: imageData,
          alt: 'Imagem de fundo personalizada',
          fit: 'cover',
          position: { x: 0, y: 0, width: 100, height: 100 },
          zIndex: 0,
          border: DEFAULT_BORDER,
          shadow: DEFAULT_SHADOW,
          opacity: 1,
          rotation: 0,
          metadata: { backgroundDecor: true, kind: 'custom-image' }
        };

        elements = [bgImage, ...elements];

        return {
          ...s,
          elements,
          updatedAt: new Date()
        };
      })
    );
  }

  // Gerar ID único
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Set hovered element
  setHoveredElement(elementId: string | null): void {
    this.hoveredElementIdSignal.set(elementId);
  }

  // Criar novo slide a partir de um layout
  createSlide(layoutId?: string): Slide {
    const layout = layoutId 
      ? this.layoutTemplates.find(l => l.id === layoutId) 
      : this.layoutTemplates.find(l => l.id === 'layout-custom');

    const newSlide: Slide = {
      id: this.generateId(),
      name: `Slide ${this.slidesSignal().length + 1}`,
      layoutId: layout?.id,
      elements: this.createElementsFromLayout(layout),
      backgroundColor: '#ffffff',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.slidesSignal.update(slides => [...slides, newSlide]);
    this.currentSlideIdSignal.set(newSlide.id);
    
    return newSlide;
  }

  // Criar novo slide com nome personalizado
  createSlideWithName(layoutId: string, slideName: string): Slide {
    const layout = this.layoutTemplates.find(l => l.id === layoutId) 
      || this.layoutTemplates.find(l => l.id === 'layout-custom');

    const newSlide: Slide = {
      id: this.generateId(),
      name: slideName || `Slide ${this.slidesSignal().length + 1}`,
      layoutId: layout?.id,
      elements: this.createElementsFromLayout(layout),
      backgroundColor: '#ffffff',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.slidesSignal.update(slides => [...slides, newSlide]);
    this.currentSlideIdSignal.set(newSlide.id);
    
    return newSlide;
  }

  // Criar elementos a partir de um layout template
  // Se o layout usar gridGuides, não cria elementos (o usuário adiciona manualmente)
  private createElementsFromLayout(layout?: LayoutTemplate): (ImageElement | TextElement)[] {
    if (!layout) return [];
    
    // Se o layout usa gridGuides, não criar elementos vazios
    // Os gridGuides são apenas guias visuais para o usuário
    if (layout.gridGuides && layout.gridGuides.length > 0) {
      return [];
    }

    return layout.elements.map((template, index) => {
      const baseElement = {
        id: this.generateId(),
        position: { ...template.position },
        zIndex: template.zIndex,
        border: { ...DEFAULT_BORDER },
        shadow: { ...DEFAULT_SHADOW },
        opacity: 100,
        rotation: 0
      };

      if (template.type === 'image') {
        return {
          ...baseElement,
          type: 'image' as const,
          src: '',
          alt: `Imagem ${index + 1}`,
          fit: 'cover' as const
        };
      } else {
        return {
          ...baseElement,
          type: 'text' as const,
          content: 'Clique para editar',
          fontSize: 16,
          fontFamily: 'Arial',
          fontWeight: 'normal' as const,
          color: '#333333',
          textAlign: 'center' as const
        };
      }
    });
  }

  // Selecionar slide
  selectSlide(slideId: string): void {
    this.currentSlideIdSignal.set(slideId);
    this.selectedElementIdSignal.set(null);
  }

  // Selecionar elemento
  selectElement(elementId: string | null): void {
    this.selectedElementIdSignal.set(elementId);
  }

  // Atualizar elemento
  updateElement(elementId: string, updates: Partial<ImageElement | TextElement>): void {
    this.slidesSignal.update(slides => 
      slides.map(slide => {
        if (slide.id !== this.currentSlideIdSignal()) return slide;
        
        return {
          ...slide,
          updatedAt: new Date(),
          elements: slide.elements.map(element => 
            element.id === elementId 
              ? { ...element, ...updates } as ImageElement | TextElement
              : element
          )
        };
      })
    );
  }

  // Atualizar posição do elemento
  updateElementPosition(elementId: string, position: Partial<ElementPosition>): void {
    const element = this.currentSlide()?.elements.find(e => e.id === elementId);
    if (element) {
      this.updateElement(elementId, {
        position: { ...element.position, ...position }
      });
    }
  }

  // Adicionar novo texto ao slide
  addTextToSlide(): void {
    const slide = this.currentSlide();
    if (!slide) return;

    const newText: TextElement = {
      id: this.generateId(),
      type: 'text',
      content: 'Digite seu texto aqui',
      fontSize: 24,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      color: '#333333',
      textAlign: 'center',
      position: { x: 20, y: 40, width: 60, height: 20 },
      zIndex: slide.elements.length + 1,
      border: DEFAULT_BORDER,
      shadow: DEFAULT_SHADOW,
      opacity: 1,
      rotation: 0
    };

    this.slidesSignal.update(slides =>
      slides.map(s => 
        s.id === slide.id 
          ? { ...s, elements: [...s.elements, newText], updatedAt: new Date() }
          : s
      )
    );

    // Selecionar o novo texto
    this.selectedElementIdSignal.set(newText.id);
  }

  // Adicionar imagem ao slide
  addImageToSlide(src: string, orderNumber?: number): void {
    const slide = this.currentSlide();
    if (!slide) return;

    // Encontrar próximo slot de imagem vazio ou criar novo
    const emptyImageSlot = slide.elements.find(
      e => e.type === 'image' && !(e as ImageElement).src
    );

    if (emptyImageSlot) {
      this.updateElement(emptyImageSlot.id, { src, orderNumber } as Partial<ImageElement>);
    } else {
      // Adicionar nova imagem
      const newImage: ImageElement = {
        id: this.generateId(),
        type: 'image',
        src,
        alt: 'Nova imagem',
        fit: 'cover',
        orderNumber,
        position: { x: 10, y: 10, width: 30, height: 30 },
        zIndex: slide.elements.length + 1,
        border: DEFAULT_BORDER,
        shadow: DEFAULT_SHADOW,
        opacity: 1,
        rotation: 0
      };

      this.slidesSignal.update(slides =>
        slides.map(s => 
          s.id === slide.id 
            ? { ...s, elements: [...s.elements, newImage], updatedAt: new Date() }
            : s
        )
      );
    }
  }

  // Extrair número do nome do arquivo (ex: "foto_1.jpg" -> 1, "image2.png" -> 2)
  extractOrderNumber(filename: string): number {
    const match = filename.match(/(\d+)(?=\.[^.]+$|\s*$)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  // Gerar posições de layout baseado na quantidade de imagens
  generateLayoutPositions(count: number): { x: number; y: number; width: number; height: number }[] {
    const positions: { x: number; y: number; width: number; height: number }[] = [];
    const padding = 2; // espaço entre elementos
    const margin = 3; // margem das bordas

    if (count === 1) {
      // Uma imagem centralizada
      positions.push({ x: 10, y: 5, width: 80, height: 70 });
    } else if (count === 2) {
      // Duas imagens lado a lado
      const width = (100 - margin * 2 - padding) / 2;
      positions.push({ x: margin, y: 5, width, height: 70 });
      positions.push({ x: margin + width + padding, y: 5, width, height: 70 });
    } else if (count === 3) {
      // Três imagens em linha
      const width = (100 - margin * 2 - padding * 2) / 3;
      for (let i = 0; i < 3; i++) {
        positions.push({ 
          x: margin + i * (width + padding), 
          y: 5, 
          width, 
          height: 70 
        });
      }
    } else if (count === 4) {
      // Grid 2x2
      const width = (100 - margin * 2 - padding) / 2;
      const height = (80 - padding) / 2;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          positions.push({
            x: margin + col * (width + padding),
            y: 3 + row * (height + padding),
            width,
            height
          });
        }
      }
    } else if (count === 5) {
      // 3 em cima, 2 embaixo
      const topWidth = (100 - margin * 2 - padding * 2) / 3;
      const bottomWidth = (100 - margin * 2 - padding) / 2;
      const height = (80 - padding) / 2;
      // Top row
      for (let i = 0; i < 3; i++) {
        positions.push({
          x: margin + i * (topWidth + padding),
          y: 3,
          width: topWidth,
          height
        });
      }
      // Bottom row
      const bottomOffset = (100 - margin * 2 - bottomWidth * 2 - padding) / 2;
      for (let i = 0; i < 2; i++) {
        positions.push({
          x: margin + bottomOffset + i * (bottomWidth + padding),
          y: 3 + height + padding,
          width: bottomWidth,
          height
        });
      }
    } else if (count === 6) {
      // Grid 3x2
      const width = (100 - margin * 2 - padding * 2) / 3;
      const height = (80 - padding) / 2;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          positions.push({
            x: margin + col * (width + padding),
            y: 3 + row * (height + padding),
            width,
            height
          });
        }
      }
    } else if (count <= 9) {
      // Grid 3x3 para 7-9 imagens
      const cols = 3;
      const rows = Math.ceil(count / cols);
      const width = (100 - margin * 2 - padding * (cols - 1)) / cols;
      const height = (85 - padding * (rows - 1)) / rows;
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        positions.push({
          x: margin + col * (width + padding),
          y: 2 + row * (height + padding),
          width,
          height
        });
      }
    } else {
      // Grid 4xN para mais de 9 imagens
      const cols = 4;
      const rows = Math.ceil(count / cols);
      const width = (100 - margin * 2 - padding * (cols - 1)) / cols;
      const height = Math.min(20, (90 - padding * (rows - 1)) / rows);
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        positions.push({
          x: margin + col * (width + padding),
          y: 2 + row * (height + padding),
          width,
          height
        });
      }
    }

    return positions;
  }

  // Adicionar múltiplas imagens no slide atual
  addMultipleImages(files: File[]): void {
    const currentSlide = this.currentSlide();
    if (!currentSlide) {
      // Se não há slide, criar um primeiro
      this.createSlide('layout-3-images-1-text');
    }
    
    const slideId = this.currentSlideIdSignal();
    if (!slideId) return;

    // Pegar elementos existentes para calcular posição e zIndex
    const slide = this.slidesSignal().find(s => s.id === slideId);
    const existingElements = slide?.elements || [];
    const maxZIndex = existingElements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);

    // Criar array com arquivos e seus números de ordem
    const filesWithOrder = files.map(file => ({
      file,
      orderNumber: this.extractOrderNumber(file.name)
    }));

    // Ordenar por número extraído do nome do arquivo
    filesWithOrder.sort((a, b) => a.orderNumber - b.orderNumber);

    // Converter cada arquivo e adicionar como novo elemento no slide atual
    filesWithOrder.forEach(({ file, orderNumber }, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        
        // Posição padrão com offset para cada imagem não sobrepor
        const offsetX = (index % 3) * 5;
        const offsetY = Math.floor(index / 3) * 5;
        
        const newImage: ImageElement = {
          id: this.generateId(),
          type: 'image',
          src,
          alt: file.name,
          fit: 'cover',
          orderNumber,
          position: {
            x: 10 + offsetX,
            y: 10 + offsetY,
            width: 30,
            height: 30
          },
          zIndex: maxZIndex + index + 1,
          border: DEFAULT_BORDER,
          shadow: DEFAULT_SHADOW,
          opacity: 1,
          rotation: 0
        };

        this.slidesSignal.update(slides =>
          slides.map(s => 
            s.id === slideId 
              ? { ...s, elements: [...s.elements, newImage], updatedAt: new Date() }
              : s
          )
        );
      };
      reader.readAsDataURL(file);
    });
  }

  // Alinhar todos os elementos do slide atual à grade
  alignElementsToGrid(gridStep: number = 5): void {
    const slide = this.currentSlide();
    if (!slide) return;

    const snap = (value: number) => {
      return Math.round(value / gridStep) * gridStep;
    };

    this.slidesSignal.update(slides =>
      slides.map(s => {
        if (s.id !== slide.id) return s;

        const alignedElements = s.elements.map(element => ({
          ...element,
          position: {
            x: snap(element.position.x),
            y: snap(element.position.y),
            width: snap(element.position.width),
            height: snap(element.position.height)
          }
        }));

        return {
          ...s,
          elements: alignedElements,
          updatedAt: new Date()
        };
      })
    );
  }

  // Adicionar imagem a partir de DataURL (usado pelo Google Photos)
  addImageFromDataUrl(dataUrl: string, filename: string): void {
    const slide = this.currentSlide();
    if (!slide) return;

    // Encontrar próximo slot de imagem vazio no slide
    const imageElements = slide.elements.filter(e => {
      if (e.type !== 'image') return false;
      const imgElement = e as ImageElement;
      return !imgElement.metadata?.['backgroundDecor'] && !imgElement.src;
    });

    if (imageElements.length > 0) {
      // Preencher slot vazio existente
      const targetElement = imageElements[0];
      
      this.slidesSignal.update(slides =>
        slides.map(s => {
          if (s.id !== slide.id) return s;
          return {
            ...s,
            elements: s.elements.map(element => {
              if (element.id === targetElement.id) {
                return {
                  ...element,
                  src: dataUrl,
                  alt: filename
                } as ImageElement;
              }
              return element;
            }),
            updatedAt: new Date()
          };
        })
      );
    } else {
      // Criar novo elemento de imagem
      const existingImages = slide.elements.filter(e => 
        e.type === 'image' && !e.metadata?.['backgroundDecor']
      );
      
      const newImage: ImageElement = {
        id: this.generateId(),
        type: 'image',
        src: dataUrl,
        alt: filename,
        fit: 'cover',
        position: {
          x: 5 + (existingImages.length % 3) * 32,
          y: 5 + Math.floor(existingImages.length / 3) * 32,
          width: 30,
          height: 30
        },
        zIndex: slide.elements.length + 1,
        border: DEFAULT_BORDER,
        shadow: DEFAULT_SHADOW,
        opacity: 1,
        rotation: 0
      };

      this.slidesSignal.update(slides =>
        slides.map(s => 
          s.id === slide.id 
            ? { ...s, elements: [...s.elements, newImage], updatedAt: new Date() }
            : s
        )
      );
    }
    
    this.saveToStorage();
  }

  // Aplicar layout a um slide existente
  applyLayout(layoutId: string): void {
    const layout = this.layoutTemplates.find(l => l.id === layoutId);
    const slide = this.currentSlide();
    
    if (!layout || !slide) return;

    // Preservar elementos de fundo decorativos (imagens de fundo)
    const backgroundElements = slide.elements.filter(e => e.metadata?.['backgroundDecor']);

    // Preservar imagens existentes (excluindo elementos de fundo)
    const existingImages = slide.elements
      .filter(e => e.type === 'image' && (e as ImageElement).src && !e.metadata?.['backgroundDecor'])
      .map(e => (e as ImageElement).src);

    // Preservar textos existentes com todas as propriedades
    const existingTexts = slide.elements
      .filter(e => e.type === 'text' && !e.metadata?.['backgroundDecor'])
      .map(e => {
        const textEl = e as TextElement;
        return {
          content: textEl.content,
          fontSize: textEl.fontSize,
          fontFamily: textEl.fontFamily,
          fontWeight: textEl.fontWeight,
          fontStyle: textEl.fontStyle,
          color: textEl.color,
          backgroundColor: textEl.backgroundColor,
          textAlign: textEl.textAlign,
          lineHeight: textEl.lineHeight,
          border: textEl.border
        };
      });

    // Criar novos elementos do layout
    const newElements = this.createElementsFromLayout(layout);

    // Reatribuir imagens existentes aos novos slots
    let imageIndex = 0;
    let textIndex = 0;
    
    newElements.forEach(element => {
      if (element.type === 'image' && imageIndex < existingImages.length) {
        (element as ImageElement).src = existingImages[imageIndex];
        imageIndex++;
      } else if (element.type === 'text' && textIndex < existingTexts.length) {
        // Preservar todas as propriedades de texto
        const savedText = existingTexts[textIndex];
        const textEl = element as TextElement;
        textEl.content = savedText.content;
        textEl.fontSize = savedText.fontSize;
        textEl.fontFamily = savedText.fontFamily;
        textEl.fontWeight = savedText.fontWeight;
        textEl.fontStyle = savedText.fontStyle;
        textEl.color = savedText.color;
        textEl.backgroundColor = savedText.backgroundColor;
        textEl.textAlign = savedText.textAlign;
        textEl.lineHeight = savedText.lineHeight;
        if (savedText.border) {
          textEl.border = savedText.border;
        }
        textIndex++;
      }
    });

    // Combinar elementos de fundo com novos elementos do layout
    const finalElements = [...backgroundElements, ...newElements];

    this.slidesSignal.update(slides =>
      slides.map(s => 
        s.id === slide.id 
          ? { ...s, layoutId, elements: finalElements, updatedAt: new Date() }
          : s
      )
    );
  }

  // Aplicar layout a um slide específico por ID
  applyLayoutToSlide(slideId: string, layoutId: string): void {
    const layout = this.layoutTemplates.find(l => l.id === layoutId);
    const slide = this.slidesSignal().find(s => s.id === slideId);
    
    if (!layout || !slide) return;

    // Preservar elementos de fundo decorativos
    const backgroundElements = slide.elements.filter(e => e.metadata?.['backgroundDecor']);

    // Preservar imagens existentes
    const existingImages = slide.elements
      .filter(e => e.type === 'image' && (e as ImageElement).src && !e.metadata?.['backgroundDecor'])
      .map(e => (e as ImageElement).src);

    // Preservar textos existentes com todas as propriedades
    const existingTexts = slide.elements
      .filter(e => e.type === 'text' && !e.metadata?.['backgroundDecor'])
      .map(e => {
        const textEl = e as TextElement;
        return {
          content: textEl.content,
          fontSize: textEl.fontSize,
          fontFamily: textEl.fontFamily,
          fontWeight: textEl.fontWeight,
          fontStyle: textEl.fontStyle,
          color: textEl.color,
          backgroundColor: textEl.backgroundColor,
          textAlign: textEl.textAlign,
          lineHeight: textEl.lineHeight,
          border: textEl.border
        };
      });

    // Criar novos elementos do layout
    const newElements = this.createElementsFromLayout(layout);

    // Reatribuir imagens e textos existentes
    let imageIndex = 0;
    let textIndex = 0;
    
    newElements.forEach(element => {
      if (element.type === 'image' && imageIndex < existingImages.length) {
        (element as ImageElement).src = existingImages[imageIndex];
        imageIndex++;
      } else if (element.type === 'text' && textIndex < existingTexts.length) {
        const savedText = existingTexts[textIndex];
        const textEl = element as TextElement;
        textEl.content = savedText.content;
        textEl.fontSize = savedText.fontSize;
        textEl.fontFamily = savedText.fontFamily;
        textEl.fontWeight = savedText.fontWeight;
        textEl.fontStyle = savedText.fontStyle;
        textEl.color = savedText.color;
        textEl.backgroundColor = savedText.backgroundColor;
        textEl.textAlign = savedText.textAlign;
        textEl.lineHeight = savedText.lineHeight;
        if (savedText.border) {
          textEl.border = savedText.border;
        }
        textIndex++;
      }
    });

    const finalElements = [...backgroundElements, ...newElements];

    this.slidesSignal.update(slides =>
      slides.map(s => 
        s.id === slideId 
          ? { ...s, layoutId, elements: finalElements, updatedAt: new Date() }
          : s
      )
    );
  }

  // Duplicar slide
  duplicateSlide(slideId: string): void {
    const slide = this.slidesSignal().find(s => s.id === slideId);
    if (!slide) return;

    const newSlide: Slide = {
      ...slide,
      id: this.generateId(),
      name: `${slide.name} (cópia)`,
      elements: slide.elements.map(e => ({ ...e, id: this.generateId() })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.slidesSignal.update(slides => [...slides, newSlide]);
  }

  // Deletar slide
  deleteSlide(slideId: string): void {
    const slides = this.slidesSignal();
    if (slides.length <= 1) return; // Manter pelo menos 1 slide

    this.slidesSignal.update(s => s.filter(slide => slide.id !== slideId));

    // Selecionar outro slide se o atual foi deletado
    if (this.currentSlideIdSignal() === slideId) {
      const remaining = this.slidesSignal();
      this.currentSlideIdSignal.set(remaining[0]?.id || null);
    }
  }

  // Deletar elemento
  deleteElement(elementId: string): void {
    this.slidesSignal.update(slides =>
      slides.map(slide => {
        if (slide.id !== this.currentSlideIdSignal()) return slide;
        
        return {
          ...slide,
          elements: slide.elements.filter(e => e.id !== elementId),
          updatedAt: new Date()
        };
      })
    );
    this.selectedElementIdSignal.set(null);
  }

  // Zoom
  setZoom(zoom: number): void {
    this.zoomSignal.set(Math.max(25, Math.min(200, zoom)));
  }

  // Atualizar cor de fundo do slide
  updateSlideBackground(color: string): void {
    this.slidesSignal.update(slides =>
      slides.map(slide => 
        slide.id === this.currentSlideIdSignal()
          ? { ...slide, backgroundColor: color, updatedAt: new Date() }
          : slide
      )
    );
  }

  // Atualizar borda do elemento
  updateElementBorder(elementId: string, borderUpdates: Partial<ElementBorderStyle>): void {
    const element = this.currentSlide()?.elements.find(e => e.id === elementId);
    if (element) {
      const currentBorder = element.border || DEFAULT_BORDER;
      this.updateElement(elementId, {
        border: { ...currentBorder, ...borderUpdates }
      });
    }
  }

  // Atualizar sombra do elemento
  updateElementShadow(elementId: string, shadowUpdates: Partial<ElementShadow>): void {
    const element = this.currentSlide()?.elements.find(e => e.id === elementId);
    if (element) {
      const currentShadow = element.shadow || DEFAULT_SHADOW;
      this.updateElement(elementId, {
        shadow: { ...currentShadow, ...shadowUpdates }
      });
    }
  }

  // Calcular linhas guia de alinhamento
  calculateAlignmentGuides(movingElementId: string, newPosition: ElementPosition): { guides: AlignmentGuide[], snappedPosition: ElementPosition } {
    const slide = this.currentSlide();
    if (!slide) return { guides: [], snappedPosition: newPosition };

    const guides: AlignmentGuide[] = [];
    const snappedPosition = { ...newPosition };
    const otherElements = slide.elements.filter(e => e.id !== movingElementId);

    // Pontos de referência do elemento em movimento
    const movingLeft = newPosition.x;
    const movingRight = newPosition.x + newPosition.width;
    const movingTop = newPosition.y;
    const movingBottom = newPosition.y + newPosition.height;
    const movingCenterX = newPosition.x + newPosition.width / 2;
    const movingCenterY = newPosition.y + newPosition.height / 2;

    // Linhas guia do canvas (centro)
    const canvasCenterX = 50;
    const canvasCenterY = 50;

    // Verificar alinhamento com centro do canvas
    if (Math.abs(movingCenterX - canvasCenterX) < this.SNAP_THRESHOLD) {
      guides.push({ type: 'vertical', position: canvasCenterX, visible: true });
      snappedPosition.x = canvasCenterX - newPosition.width / 2;
    }
    if (Math.abs(movingCenterY - canvasCenterY) < this.SNAP_THRESHOLD) {
      guides.push({ type: 'horizontal', position: canvasCenterY, visible: true });
      snappedPosition.y = canvasCenterY - newPosition.height / 2;
    }

    // Verificar alinhamento com outros elementos
    for (const element of otherElements) {
      const elLeft = element.position.x;
      const elRight = element.position.x + element.position.width;
      const elTop = element.position.y;
      const elBottom = element.position.y + element.position.height;
      const elCenterX = element.position.x + element.position.width / 2;
      const elCenterY = element.position.y + element.position.height / 2;

      // Alinhamentos verticais
      // Esquerda com esquerda
      if (Math.abs(movingLeft - elLeft) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'vertical', position: elLeft, visible: true });
        snappedPosition.x = elLeft;
      }
      // Direita com direita
      if (Math.abs(movingRight - elRight) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'vertical', position: elRight, visible: true });
        snappedPosition.x = elRight - newPosition.width;
      }
      // Centro com centro
      if (Math.abs(movingCenterX - elCenterX) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'vertical', position: elCenterX, visible: true });
        snappedPosition.x = elCenterX - newPosition.width / 2;
      }
      // Esquerda com direita
      if (Math.abs(movingLeft - elRight) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'vertical', position: elRight, visible: true });
        snappedPosition.x = elRight;
      }
      // Direita com esquerda
      if (Math.abs(movingRight - elLeft) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'vertical', position: elLeft, visible: true });
        snappedPosition.x = elLeft - newPosition.width;
      }

      // Alinhamentos horizontais
      // Topo com topo
      if (Math.abs(movingTop - elTop) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'horizontal', position: elTop, visible: true });
        snappedPosition.y = elTop;
      }
      // Base com base
      if (Math.abs(movingBottom - elBottom) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'horizontal', position: elBottom, visible: true });
        snappedPosition.y = elBottom - newPosition.height;
      }
      // Centro com centro
      if (Math.abs(movingCenterY - elCenterY) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'horizontal', position: elCenterY, visible: true });
        snappedPosition.y = elCenterY - newPosition.height / 2;
      }
      // Topo com base
      if (Math.abs(movingTop - elBottom) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'horizontal', position: elBottom, visible: true });
        snappedPosition.y = elBottom;
      }
      // Base com topo
      if (Math.abs(movingBottom - elTop) < this.SNAP_THRESHOLD) {
        guides.push({ type: 'horizontal', position: elTop, visible: true });
        snappedPosition.y = elTop - newPosition.height;
      }
    }

    // Remover duplicatas
    const uniqueGuides = guides.filter((guide, index, self) =>
      index === self.findIndex(g => g.type === guide.type && g.position === guide.position)
    );

    this.alignmentGuidesSignal.set(uniqueGuides);
    return { guides: uniqueGuides, snappedPosition };
  }

  // Limpar linhas guia
  clearAlignmentGuides(): void {
    this.alignmentGuidesSignal.set([]);
  }

  // ==========================================
  // Importação em Lote de Fotos
  // ==========================================

  /**
   * Conta o total de slots de imagem disponíveis (sem src) em todos os slides
   */
  getTotalImageSlots(): number {
    const slides = this.slidesSignal();
    let total = 0;

    for (const slide of slides) {
      for (const element of slide.elements) {
        if (element.type === 'image') {
          const imgElement = element as ImageElement;
          // Conta slots vazios (sem src ou src vazio)
          if (!imgElement.src || imgElement.src === '') {
            total++;
          }
        }
      }
    }

    return total;
  }

  /**
   * Obtém todos os slots de imagem vazios ordenados por slide e posição
   */
  private getEmptyImageSlots(): Array<{ slideId: string; elementId: string; slideIndex: number; elementIndex: number }> {
    const slides = this.slidesSignal();
    const slots: Array<{ slideId: string; elementId: string; slideIndex: number; elementIndex: number }> = [];

    slides.forEach((slide, slideIndex) => {
      slide.elements.forEach((element, elementIndex) => {
        if (element.type === 'image') {
          const imgElement = element as ImageElement;
          // Ignora elementos de fundo (decorativos)
          if (imgElement.metadata?.['backgroundDecor']) {
            return;
          }
          // Slots vazios
          if (!imgElement.src || imgElement.src === '') {
            slots.push({
              slideId: slide.id,
              elementId: element.id,
              slideIndex,
              elementIndex
            });
          }
        }
      });
    });

    return slots;
  }

  /**
   * Importa fotos para os slides distribuindo nos slots de imagem vazios
   */
  async importPhotosToSlides(photos: Array<{ orderNumber: number; dataUrl: string; name: string }>): Promise<{ imported: number; remaining: number; slidesUsed: number }> {
    // Ordenar fotos por número
    const sortedPhotos = [...photos].sort((a, b) => a.orderNumber - b.orderNumber);
    
    // Obter slots vazios
    const emptySlots = this.getEmptyImageSlots();
    
    let imported = 0;
    const slidesUsed = new Set<string>();

    // Distribuir fotos nos slots
    for (let i = 0; i < sortedPhotos.length && i < emptySlots.length; i++) {
      const photo = sortedPhotos[i];
      const slot = emptySlots[i];

      // Atualizar o elemento com a foto
      this.slidesSignal.update(slides =>
        slides.map(slide => {
          if (slide.id === slot.slideId) {
            return {
              ...slide,
              elements: slide.elements.map(element => {
                if (element.id === slot.elementId) {
                  return {
                    ...element,
                    src: photo.dataUrl,
                    alt: photo.name,
                    orderNumber: photo.orderNumber
                  } as ImageElement;
                }
                return element;
              }),
              updatedAt: new Date()
            };
          }
          return slide;
        })
      );

      imported++;
      slidesUsed.add(slot.slideId);
    }

    const remaining = sortedPhotos.length - imported;

    return {
      imported,
      remaining,
      slidesUsed: slidesUsed.size
    };
  }

  /**
   * Limpa todas as imagens dos slides (reseta os slots)
   */
  clearAllImages(): void {
    this.slidesSignal.update(slides =>
      slides.map(slide => ({
        ...slide,
        elements: slide.elements.map(element => {
          if (element.type === 'image') {
            const imgElement = element as ImageElement;
            // Não limpa elementos decorativos de fundo
            if (imgElement.metadata?.['backgroundDecor']) {
              return element;
            }
            return {
              ...element,
              src: '',
              alt: '',
              orderNumber: undefined
            } as ImageElement;
          }
          return element;
        }),
        updatedAt: new Date()
      }))
    );
  }

  /**
   * Importa fotos com configuração avançada (destino específico por foto)
   */
  async importPhotosToSlidesAdvanced(
    photos: Array<{ orderNumber: number; dataUrl: string; name: string; targetSlide: number; slotInSlide: number }>,
    slideConfigs: Array<{ slideNumber: number; layoutId: string; exists: boolean; photos: any[] }>
  ): Promise<{ imported: number; slidesCreated: number }> {
    let imported = 0;
    let slidesCreated = 0;

    // Agrupar fotos por slide de destino
    const photosBySlide = new Map<number, typeof photos>();
    
    for (const photo of photos) {
      const slidePhotos = photosBySlide.get(photo.targetSlide) || [];
      slidePhotos.push(photo);
      photosBySlide.set(photo.targetSlide, slidePhotos);
    }

    // Processar cada slide na ordem
    const slideNumbers = Array.from(photosBySlide.keys()).sort((a, b) => a - b);
    
    for (const slideNumber of slideNumbers) {
      const slidePhotos = photosBySlide.get(slideNumber) || [];
      const slideIndex = slideNumber - 1;
      
      // Obter slides atualizados (importante para pegar novos slides criados)
      const currentSlides = this.slidesSignal();
      
      // Verificar se o slide existe
      if (slideIndex >= currentSlides.length) {
        slidesCreated++;
        continue; // Slide deveria ter sido criado antes
      }

      const slide = currentSlides[slideIndex];
      if (!slide) continue;

      // Ordenar fotos pelo slot
      const sortedPhotos = slidePhotos.sort((a, b) => a.slotInSlide - b.slotInSlide);

      // Obter elementos de imagem do slide (não decorativos), ordenados por posição
      const imageElements = slide.elements
        .filter(e => {
          if (e.type !== 'image') return false;
          const imgElement = e as ImageElement;
          return !imgElement.metadata?.['backgroundDecor'];
        })
        .sort((a, b) => {
          // Ordenar por posição Y e depois X para manter ordem visual
          if (a.position.y !== b.position.y) {
            return a.position.y - b.position.y;
          }
          return a.position.x - b.position.x;
        });

      // Atribuir fotos aos slots
      for (const photo of sortedPhotos) {
        const slotIndex = photo.slotInSlide - 1;
        const targetElement = imageElements[slotIndex];

        if (targetElement) {
          this.slidesSignal.update(allSlides =>
            allSlides.map((s, idx) => {
              if (idx === slideIndex) {
                return {
                  ...s,
                  elements: s.elements.map(element => {
                    if (element.id === targetElement.id) {
                      return {
                        ...element,
                        src: photo.dataUrl,
                        alt: photo.name,
                        orderNumber: photo.orderNumber
                      } as ImageElement;
                    }
                    return element;
                  }),
                  updatedAt: new Date()
                };
              }
              return s;
            })
          );
          imported++;
        } else {
          console.warn(`Slot ${photo.slotInSlide} não encontrado no slide ${slideNumber}`);
        }
      }
    }

    // Salvar após todas as importações
    this.saveToStorage();

    return { imported, slidesCreated };
  }
}
