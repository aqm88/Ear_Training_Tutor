import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <header>
        <app-user-profile></app-user-profile>
      </header>
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      padding: 1rem;
      background-color: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      position: relative;
      z-index: 1000;
    }

    main {
      flex: 1;
      position: relative;
    }
  `]
})
export class AppComponent {
  title = 'ear_training_tutor';
} 