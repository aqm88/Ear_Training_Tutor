import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-welcome',
  template: `
    <div class="welcome-container">
      <div class="error-toast" *ngIf="showError">
        <div class="error-message">
          Please create or select a profile before accessing settings
        </div>
      </div>
      
      <div class="welcome-content">
        <h1>Welcome to Ear Training Tutor</h1>
        <p class="subtitle">Your personal companion for developing perfect pitch and musical ear</p>
        
        <div class="menu-options">
          <button class="menu-button" (click)="startTraining()">
            <span class="icon">🎵</span>
            Start Training
          </button>
          
          <button class="menu-button" (click)="viewProgress()">
            <span class="icon">📊</span>
            View Progress
          </button>
          
          <button class="menu-button" (click)="openSettings()">
            <span class="icon">⚙️</span>
            Settings
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .welcome-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      position: relative;
    }

    .error-toast {
      position: absolute;
      top: 1rem;
      right: 1rem;
      pointer-events: none;
      z-index: 100;
    }

    .error-message {
      background-color: #fee2e2;
      border: 1px solid #ef4444;
      color: #b91c1c;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      opacity: 0;
      animation: slideIn 0.3s forwards;
      white-space: nowrap;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .welcome-content {
      text-align: center;
      max-width: 600px;
      width: 100%;
    }

    h1 {
      font-size: 2.5rem;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .subtitle {
      font-size: 1.2rem;
      color: #7f8c8d;
      margin-bottom: 3rem;
    }

    .menu-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 300px;
      margin: 0 auto;
    }

    .menu-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem 2rem;
      font-size: 1.1rem;
      color: white;
      background-color: #3498db;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.2s, background-color 0.2s;
    }

    .menu-button:hover {
      transform: translateY(-2px);
      background-color: #2980b9;
    }

    .icon {
      font-size: 1.3rem;
    }
  `]
})
export class WelcomeComponent {
  showError = false;

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  startTraining() {
    this.userService.getCurrentUser()
      .pipe(take(1))
      .subscribe(currentUser => {
        if (!currentUser) {
          this.showError = true;
          setTimeout(() => {
            this.showError = false;
          }, 3000);
          return;
        }
        
        this.router.navigate(['/training']);
      });
  }

  viewProgress() {
    this.userService.getCurrentUser()
      .pipe(take(1))
      .subscribe(currentUser => {
        if (!currentUser) {
          this.showError = true;
          setTimeout(() => {
            this.showError = false;
          }, 3000);
          return;
        }
        
        this.router.navigate(['/progress']);
      });
  }

  openSettings() {
    this.userService.getCurrentUser()
      .pipe(take(1))
      .subscribe(currentUser => {
        if (!currentUser) {
          this.showError = true;
          setTimeout(() => {
            this.showError = false;
          }, 3000); // Hide error after 3 seconds
          return;
        }
        
        this.router.navigate(['/settings']);
      });
  }
} 