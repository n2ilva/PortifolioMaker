import { Component, inject, ViewChild } from '@angular/core';
import { SlideService } from '../../services/slide.service';
import { SlideCanvas } from '../slide-canvas/slide-canvas';
import { Sidebar } from '../sidebar/sidebar';
import { SlideList } from '../slide-list/slide-list';
import { Toolbar } from '../toolbar/toolbar';
import { PhotoImportComponent } from '../photo-import/photo-import';
import { PresentationComponent } from '../presentation/presentation';

@Component({
  selector: 'app-editor',
  imports: [SlideCanvas, Sidebar, SlideList, Toolbar, PhotoImportComponent, PresentationComponent],
  templateUrl: './editor.html',
  styleUrl: './editor.css'
})
export class Editor {
  slideService = inject(SlideService);
  
  @ViewChild('photoImport') photoImport!: PhotoImportComponent;
  @ViewChild('presentation') presentation!: PresentationComponent;

  openBatchImport(): void {
    this.photoImport.open();
  }

  startPresentation(): void {
    this.presentation.open();
  }
}
