import { LayoutTemplate } from './slide.model';

// Layouts pré-definidos - definem apenas a grade de referência, não criam elementos
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'layout-3-images',
    name: '3 Fotos',
    description: 'Grade para três imagens em linha',
    gridGuides: [
      { x: 2, y: 5, width: 30, height: 90, label: 'Foto 1' },
      { x: 35, y: 5, width: 30, height: 90, label: 'Foto 2' },
      { x: 68, y: 5, width: 30, height: 90, label: 'Foto 3' }
    ],
    elements: []
  },
  {
    id: 'layout-2-images',
    name: '2 Fotos',
    description: 'Grade para duas imagens lado a lado',
    gridGuides: [
      { x: 5, y: 5, width: 43, height: 90, label: 'Foto 1' },
      { x: 52, y: 5, width: 43, height: 90, label: 'Foto 2' }
    ],
    elements: []
  },
  {
    id: 'layout-1-image',
    name: '1 Foto',
    description: 'Grade para uma imagem grande',
    gridGuides: [
      { x: 5, y: 5, width: 90, height: 90, label: 'Foto' }
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
    id: 'layout-6-images-grid',
    name: '6 Fotos em Grade',
    description: 'Grade para seis imagens em formato 3x2',
    gridGuides: [
      { x: 2, y: 5, width: 30, height: 43, label: 'Foto 1' },
      { x: 35, y: 5, width: 30, height: 43, label: 'Foto 2' },
      { x: 68, y: 5, width: 30, height: 43, label: 'Foto 3' },
      { x: 2, y: 52, width: 30, height: 43, label: 'Foto 4' },
      { x: 35, y: 52, width: 30, height: 43, label: 'Foto 5' },
      { x: 68, y: 52, width: 30, height: 43, label: 'Foto 6' }
    ],
    elements: []
  },
  {
    id: 'layout-8-images-grid',
    name: '8 Fotos em Grade',
    description: 'Grade para oito imagens em formato 4x2',
    gridGuides: [
      { x: 2, y: 5, width: 22, height: 43, label: 'Foto 1' },
      { x: 26, y: 5, width: 22, height: 43, label: 'Foto 2' },
      { x: 50, y: 5, width: 22, height: 43, label: 'Foto 3' },
      { x: 74, y: 5, width: 22, height: 43, label: 'Foto 4' },
      { x: 2, y: 52, width: 22, height: 43, label: 'Foto 5' },
      { x: 26, y: 52, width: 22, height: 43, label: 'Foto 6' },
      { x: 50, y: 52, width: 22, height: 43, label: 'Foto 7' },
      { x: 74, y: 52, width: 22, height: 43, label: 'Foto 8' }
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
