import { LayoutTemplate } from './slide.model';

// Layouts pré-definidos
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'layout-3-images-1-text',
    name: '3 Fotos + Texto',
    description: 'Três imagens em linha com campo de texto abaixo',
    elements: [
      {
        type: 'image',
        position: { x: 2, y: 5, width: 30, height: 55 },
        zIndex: 1
      },
      {
        type: 'image',
        position: { x: 35, y: 5, width: 30, height: 55 },
        zIndex: 1
      },
      {
        type: 'image',
        position: { x: 68, y: 5, width: 30, height: 55 },
        zIndex: 1
      },
      {
        type: 'text',
        position: { x: 5, y: 65, width: 90, height: 30 },
        zIndex: 2
      }
    ]
  },
  {
    id: 'layout-2-images-1-text',
    name: '2 Fotos + Texto',
    description: 'Duas imagens lado a lado com texto abaixo',
    elements: [
      {
        type: 'image',
        position: { x: 5, y: 5, width: 43, height: 55 },
        zIndex: 1
      },
      {
        type: 'image',
        position: { x: 52, y: 5, width: 43, height: 55 },
        zIndex: 1
      },
      {
        type: 'text',
        position: { x: 5, y: 65, width: 90, height: 30 },
        zIndex: 2
      }
    ]
  },
  {
    id: 'layout-1-image-1-text',
    name: '1 Foto + Texto',
    description: 'Uma imagem grande com texto ao lado',
    elements: [
      {
        type: 'image',
        position: { x: 5, y: 5, width: 55, height: 90 },
        zIndex: 1
      },
      {
        type: 'text',
        position: { x: 65, y: 5, width: 30, height: 90 },
        zIndex: 2
      }
    ]
  },
  {
    id: 'layout-4-images-grid',
    name: '4 Fotos em Grade',
    description: 'Quatro imagens em formato de grade 2x2',
    elements: [
      {
        type: 'image',
        position: { x: 5, y: 5, width: 43, height: 43 },
        zIndex: 1
      },
      {
        type: 'image',
        position: { x: 52, y: 5, width: 43, height: 43 },
        zIndex: 1
      },
      {
        type: 'image',
        position: { x: 5, y: 52, width: 43, height: 43 },
        zIndex: 1
      },
      {
        type: 'image',
        position: { x: 52, y: 52, width: 43, height: 43 },
        zIndex: 1
      }
    ]
  },
  {
    id: 'layout-text-only',
    name: 'Apenas Texto',
    description: 'Slide com título e corpo de texto',
    elements: [
      {
        type: 'text',
        position: { x: 10, y: 10, width: 80, height: 20 },
        zIndex: 1
      },
      {
        type: 'text',
        position: { x: 10, y: 35, width: 80, height: 55 },
        zIndex: 2
      }
    ]
  },
  {
    id: 'layout-custom',
    name: 'Personalizado',
    description: 'Slide em branco para customização total',
    elements: []
  }
];
