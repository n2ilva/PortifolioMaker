import { Component } from '@angular/core';
import { Editor } from './components/editor/editor';

@Component({
  selector: 'app-root',
  imports: [Editor],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'PortifolioMaker';
}
