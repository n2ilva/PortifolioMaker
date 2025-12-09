import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SlideService } from '../../services/slide.service';
import { Slide } from '../../models/slide.model';

@Component({
  selector: 'app-slide-list',
  imports: [CommonModule],
  templateUrl: './slide-list.html',
  styleUrl: './slide-list.css'
})
export class SlideList {
  slideService = inject(SlideService);

  onSelectSlide(slide: Slide): void {
    this.slideService.selectSlide(slide.id);
  }

  onDuplicateSlide(event: Event, slide: Slide): void {
    event.stopPropagation();
    this.slideService.duplicateSlide(slide.id);
  }

  onDeleteSlide(event: Event, slide: Slide): void {
    event.stopPropagation();
    this.slideService.deleteSlide(slide.id);
  }

  getSlidePreviewStyle(slide: Slide): { [key: string]: string } {
    return {
      'background-color': slide.backgroundColor
    };
  }
}
