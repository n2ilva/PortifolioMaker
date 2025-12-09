// Tipos de elementos que podem existir em um slide
export type ElementType = 'image' | 'text';

// Posição e dimensões de um elemento
export interface ElementPosition {
  x: number;      // posição X em porcentagem (0-100)
  y: number;      // posição Y em porcentagem (0-100)
  width: number;  // largura em porcentagem
  height: number; // altura em porcentagem
}

// Estilo de borda do elemento
export interface ElementBorderStyle {
  radius: number;       // raio da borda em pixels
  width: number;        // largura da borda
  color: string;        // cor da borda
  style: 'none' | 'solid' | 'dashed' | 'dotted';
}

// Sombra do elemento
export interface ElementShadow {
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  color: string;
}

// Elemento base
export interface SlideElement {
  id: string;
  type: ElementType;
  position: ElementPosition;
  zIndex: number;
  border?: ElementBorderStyle;
  shadow?: ElementShadow;
  opacity?: number;
  rotation?: number;
  metadata?: { [key: string]: any };
}

// Elemento de imagem
export interface ImageElement extends SlideElement {
  type: 'image';
  src: string;
  alt: string;
  fit: 'cover' | 'contain' | 'fill';
  orderNumber?: number; // número extraído do nome do arquivo
}

// Elemento de texto
export interface TextElement extends SlideElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight?: number; // multiplicador (ex: 1.2, 1.5)
  backgroundColor?: string;
}

// Linha guia de alinhamento
export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number; // posição em porcentagem
  visible: boolean;
}

// Template de elemento para layouts (sem propriedades opcionais obrigatórias)
export interface LayoutElementTemplate {
  type: ElementType;
  position: ElementPosition;
  zIndex: number;
}

// Guia de grade do layout (área de referência visual)
export interface LayoutGridGuide {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

// Layout pré-definido
export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  gridGuides?: LayoutGridGuide[]; // Guias visuais para posicionamento
  elements: LayoutElementTemplate[];
}

// Slide completo
export interface Slide {
  id: string;
  name: string;
  layoutId?: string;
  elements: (ImageElement | TextElement)[];
  backgroundColor: string;
  createdAt: Date;
  updatedAt: Date;
}

// Estado do editor
export interface EditorState {
  slides: Slide[];
  currentSlideId: string | null;
  selectedElementId: string | null;
  zoom: number;
}
