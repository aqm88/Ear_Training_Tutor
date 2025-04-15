import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Subscription } from 'rxjs';

interface TrainingOption {
  name: string;
  description: string;
  icon: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-training-selection',
  template: `
    <div class="training-selection-container">
      <div class="error-toast" *ngIf="showError">
        <div class="error-message">
          Please create or select a profile before starting training
        </div>
      </div>
      
      <div class="header" *ngIf="currentUser">
        <h1>Select Training Type</h1>
        <p class="subtitle">Choose a training module to begin your ear training journey</p>
      </div>

      <div class="training-grid" *ngIf="currentUser">
        <div class="grid-container">
          <div class="training-card" 
               *ngFor="let training of trainingOptions"
               (click)="handleTrainingSelection(training)"
               [class.disabled]="training.disabled">
            <div class="card-content">
              <div class="training-icon">{{ training.icon }}</div>
              <h2 class="training-name">{{ training.name }}</h2>
              <p class="training-description">{{ training.description }}</p>
              <div class="coming-soon-badge" *ngIf="training.disabled">Coming Soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .training-selection-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
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

    .header {
      text-align: center;
      margin-bottom: 3rem;
    }

    h1 {
      font-size: 2.5rem;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .subtitle {
      font-size: 1.2rem;
      color: #7f8c8d;
    }

    .training-grid {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(3, minmax(300px, 350px));
      gap: 2rem;
      justify-content: center;
    }

    @media (max-width: 1200px) {
      .grid-container {
        grid-template-columns: repeat(2, minmax(300px, 350px));
      }
    }

    @media (max-width: 800px) {
      .grid-container {
        grid-template-columns: minmax(300px, 350px);
      }
    }

    .training-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
      overflow: hidden;
      height: 100%;
    }

    .training-card:hover:not(.disabled) {
      transform: translateY(-5px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .training-card.disabled {
      background: #f5f5f5;
      cursor: not-allowed;
      opacity: 0.7;
    }

    .card-content {
      padding: 2rem;
      text-align: center;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }

    .training-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .training-name {
      font-size: 1.5rem;
      color: #2c3e50;
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .training-description {
      color: #7f8c8d;
      line-height: 1.5;
      font-size: 1rem;
    }

    .coming-soon-badge {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background-color: #3498db;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
  `]
})
export class TrainingSelectionComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  showError = false;
  private userSubscription?: Subscription;
  
  trainingOptions: TrainingOption[] = [
    {
      name: 'Note Recognition',
      description: 'Train your ability to identify individual musical notes by their sound. Perfect for developing absolute pitch.',
      icon: '🎵',
      disabled: true
    },
    {
      name: 'Interval Training',
      description: 'Learn to recognize the distance between two notes. Essential for developing relative pitch and understanding melody.',
      icon: '🎼',
      disabled: false
    },
    {
      name: 'Chord Recognition',
      description: 'Practice identifying different types of chords by ear. Great for understanding harmony and chord progressions.',
      icon: '🎹',
      disabled: true
    },
    {
      name: 'Return To Menu',
      description: 'Return to the main menu',
      icon: '🔙',
      disabled: false
    }
  ];

  constructor(
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.userSubscription = this.userService.getCurrentUser().subscribe(user => {
      if (!user) {
        this.showError = true;
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 3000);
        return;
      }
      this.currentUser = user;
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
  }

  handleTrainingSelection(training: TrainingOption) {
    if (training.disabled) {
      return;
    }
    
    if (training.name === 'Return To Menu') {
      this.router.navigate(['/']);
    } else if (training.name === 'Interval Training') {
      this.router.navigate(['/interval-training']);
    } else {
      // This code won't execute since we've added checks for disabled options
      console.log(`Selected training: ${training.name}`);
    }
  }
} 