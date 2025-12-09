import { LayoutTemplate } from './slide.model';

// Layouts pré-definidos - definem apenas a grade de referência, não criam elementos
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'layout-3-images-1-text',
    name: '3 Fotos + Texto',
    description: 'Grade para três imagens em linha com campo de texto abaixo',
    gridGuides: [
      { x: 2, y: 5, width: 30, height: 55, label: 'Foto 1' },
      { x: 35, y: 5, width: 30, height: 55, label: 'Foto 2' },
      { x: 68, y: 5, width: 30, height: 55, label: 'Foto 3' },
      { x: 5, y: 65, width: 90, height: 30, label: 'Texto' }
    ],
    elements: []
  },
  {
    id: 'layout-2-images-1-text',
    name: '2 Fotos + Texto',
    description: 'Grade para duas imagens lado a lado com texto abaixo',
    gridGuides: [
      { x: 5, y: 5, width: 43, height: 55, label: 'Foto 1' },
      { x: 52, y: 5, width: 43, height: 55, label: 'Foto 2' },
      { x: 5, y: 65, width: 90, height: 30, label: 'Texto' }
    ],
    elements: []
  },
  {
    id: 'layout-1-image-1-text',
    name: '1 Foto + Texto',
    description: 'Grade para uma imagem grande com texto ao lado',
    gridGuides: [
      { x: 5, y: 5, width: 55, height: 90, label: 'Foto' },
      { x: 65, y: 5, width: 30, height: 90, label: 'Texto' }
    ],
    elements: []
  },
  {
    id: 'layout-4-images-grid',
    name: '4 Fotos em Grade',
    description: 'Grade para quatro imagens em formato 2x2',
    gridGuides: [
      { x: 5, y: 5, width: 43, height: 43, label: 'Foto 1' },
      { x: 52, y: 5, width: 43, height: 43, label: 'Foto 2' },
      { x: 5, y: 52, width: 43, height: 43, label: 'Foto 3' },
      { x: 52, y: 52, width: 43, height: 43, label: 'Foto 4' }
    ],
    elements: []
  },
  {
    id: 'layout-text-only',
    name: 'Apenas Texto',
    description: 'Grade para título e corpo de texto',
    gridGuides: [
      { x: 10, y: 10, width: 80, height: 20, label: 'Título' },
      { x: 10, y: 35, width: 80, height: 55, label: 'Corpo' }
    ],
    elements: []
  },
  {
    id: 'layout-custom',
    name: 'Personalizado',
    description: 'Slide em branco para customização total',
    gridGuides: [],
    elements: []
  }
];
