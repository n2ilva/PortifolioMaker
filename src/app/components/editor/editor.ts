import { Component, inject, ViewChild } from '@angular/core';
import { SlideService } from '../../services/slide.service';
import { SlideCanvas } from '../slide-canvas/slide-canvas';
import { Sidebar } from '../sidebar/sidebar';
import { SlideList } from '../slide-list/slide-list';
import { Toolbar } from '../toolbar/toolbar';
import { PhotoImportComponent } from '../photo-import/photo-import';

@Component({
  selector: 'app-editor',
  imports: [SlideCanvas, Sidebar, SlideList, Toolbar, PhotoImportComponent],
  templateUrl: './editor.html',
  styleUrl: './editor.css'
})
export class Editor {
  slideService = inject(SlideService);
  
  @ViewChild('photoImport') photoImport!: PhotoImportComponent;

  openBatchImport(): void {
    this.photoImport.open();
  }
}
