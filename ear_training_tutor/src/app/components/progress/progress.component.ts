import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-progress',
  template: `
    <div class="progress-container">
      <div class="progress-content">
        <h2>Training Progress</h2>
        
        <div class="overall-stats">
          <div class="stat-card">
            <h3>Total Exercises</h3>
            <p class="stat-value">{{ getTotalExercises() }}</p>
          </div>
          <div class="stat-card">
            <h3>Last Session</h3>
            <p class="stat-value">{{ getLastSessionDate() }}</p>
          </div>
          <div class="stat-card">
            <h3>Overall Accuracy</h3>
            <p class="stat-value">{{ getOverallAccuracy() }}%</p>
          </div>
        </div>

        <div class="interval-training-progress">
          <h3>Interval Training</h3>
          
          <div class="proficiency-status">
            <p class="current-level">
              Current Level: <span class="level-indicator" [class]="currentUser?.intervalTraining?.proficiencyLevel">{{ getProficiencyLevelDisplay() }}</span>
              <span class="proficiency-info">80% accuracy with at least 10 attempts needed to advance</span>
            </p>
          </div>

          <div class="interval-categories">
            <div class="interval-category" [class.current-level]="currentUser?.intervalTraining?.proficiencyLevel === 'easy'">
              <h4>Perfect Intervals <span class="level-tag easy-level">Easy Level</span></h4>
              <div class="accuracy-container">
                <div class="accuracy-bar">
                  <div class="accuracy-fill" [style.width.%]="getAccuracyPercentage('easy')"></div>
                  <div class="threshold-line" title="80% proficiency threshold"></div>
                </div>
                <p class="accuracy-summary">Accuracy: {{ getAccuracyPercentage('easy') }}% ({{ getAttemptsForCategory('easy') }} attempts)</p>
              </div>
              <div class="interval-list">
                <div class="interval-items">
                  <div *ngFor="let interval of getIntervalDetails('Perfect')" class="interval-item">
                    <span class="interval-name">{{ interval.name }}</span>
                    <div class="interval-stats">
                      <span class="interval-accuracy" [class.good]="interval.accuracy >= 80" [class.poor]="interval.accuracy < 50">
                        {{ interval.accuracy }}%
                      </span>
                      <span class="interval-score">{{ interval.correct }}/{{ interval.attempts }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="interval-category" [class.current-level]="currentUser?.intervalTraining?.proficiencyLevel === 'medium'">
              <h4>Major Intervals <span class="level-tag medium-level">Medium Level</span></h4>
              <div class="accuracy-container">
                <div class="accuracy-bar">
                  <div class="accuracy-fill" [style.width.%]="getAccuracyPercentage('medium')"></div>
                  <div class="threshold-line" title="80% proficiency threshold"></div>
                </div>
                <p class="accuracy-summary">Accuracy: {{ getAccuracyPercentage('medium') }}% ({{ getAttemptsForCategory('medium') }} attempts)</p>
              </div>
              <div class="interval-list">
                <div class="interval-items">
                  <div *ngFor="let interval of getIntervalDetails('Major')" class="interval-item">
                    <span class="interval-name">{{ interval.name }}</span>
                    <div class="interval-stats">
                      <span class="interval-accuracy" [class.good]="interval.accuracy >= 80" [class.poor]="interval.accuracy < 50">
                        {{ interval.accuracy }}%
                      </span>
                      <span class="interval-score">{{ interval.correct }}/{{ interval.attempts }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="interval-category" [class.current-level]="currentUser?.intervalTraining?.proficiencyLevel === 'hard'">
              <h4>Minor & Tritone <span class="level-tag hard-level">Hard Level</span></h4>
              <div class="accuracy-container">
                <div class="accuracy-bar">
                  <div class="accuracy-fill" [style.width.%]="getAccuracyPercentage('hard')"></div>
                  <div class="threshold-line" title="80% proficiency threshold"></div>
                </div>
                <p class="accuracy-summary">Accuracy: {{ getAccuracyPercentage('hard') }}% ({{ getAttemptsForCategory('hard') }} attempts)</p>
              </div>
              <div class="interval-list">
                <div class="interval-items">
                  <div *ngFor="let interval of getIntervalDetails('Minor')" class="interval-item">
                    <span class="interval-name">{{ interval.name }}</span>
                    <div class="interval-stats">
                      <span class="interval-accuracy" [class.good]="interval.accuracy >= 80" [class.poor]="interval.accuracy < 50">
                        {{ interval.accuracy }}%
                      </span>
                      <span class="interval-score">{{ interval.correct }}/{{ interval.attempts }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="interval-category mastery" [class.current-level]="currentUser?.intervalTraining?.proficiencyLevel === 'mastery'">
              <h4>Mastery Level <span class="level-tag mastery-level">All Intervals</span></h4>
              <p class="mastery-text">{{ currentUser?.intervalTraining?.proficiencyLevel === 'mastery' ? 'You have achieved mastery level! All intervals will now be presented with equal frequency.' : 'Complete the Hard Level to reach Mastery.' }}</p>
            </div>
          </div>
        </div>

        <div class="action-buttons">
          <button class="back-button" (click)="goBack()">Back to Main Menu</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .progress-container {
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .progress-content {
      background-color: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 2rem;
      text-align: center;
    }

    h3 {
      color: #34495e;
      margin-bottom: 1rem;
    }

    h4 {
      color: #2c3e50;
      margin: 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #3498db;
      font-size: 1.2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .overall-stats {
      display: flex;
      justify-content: space-around;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .stat-card {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      flex: 1;
      min-width: 200px;
    }

    .stat-value {
      font-size: 2rem;
      color: #3498db;
      margin: 0;
    }

    .interval-training-progress {
      margin-bottom: 2rem;
    }

    .proficiency-status {
      margin-bottom: 1.5rem;
      background-color: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .current-level {
      font-size: 1.2rem;
      color: #34495e;
      margin: 0;
    }

    .level-indicator {
      display: inline-block;
      padding: 0.3rem 0.7rem;
      border-radius: 12px;
      color: white;
      margin-left: 0.5rem;
    }

    .level-indicator.easy {
      background-color: #3498db;
    }

    .level-indicator.medium {
      background-color: #f39c12;
    }

    .level-indicator.hard {
      background-color: #e74c3c;
    }

    .level-indicator.mastery {
      background-image: linear-gradient(45deg, #9b59b6, #3498db);
    }

    .interval-categories {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .interval-category {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .interval-category.current-level {
      border: 2px solid #3498db;
      transform: scale(1.02);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .accuracy-container {
      margin-bottom: 1rem;
    }

    .accuracy-bar {
      height: 20px;
      background-color: #f3f3f3;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 0.8rem;
      position: relative;
    }

    .accuracy-fill {
      height: 100%;
      background-color: #3498db;
      transition: width 0.5s ease-out;
    }

    .threshold-line {
      position: absolute;
      height: 100%;
      width: 2px;
      background-color: rgba(0, 0, 0, 0.3);
      left: 80%;
      top: 0;
    }

    .accuracy-summary {
      font-size: 1.1rem;
      color: #2c3e50;
      margin-bottom: 1.2rem;
    }

    .proficiency-info {
      font-size: 0.9rem;
      font-style: italic;
      color: #666;
      display: block;
      margin-top: 0.5rem;
    }

    .interval-list {
      margin-top: 1.2rem;
      background-color: white;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }

    .interval-items {
      line-height: 1.8;
      color: #34495e;
    }

    .interval-item {
      display: flex;
      justify-content: space-between;
      padding: 0.7rem 0;
      border-bottom: 1px solid #eee;
    }

    .interval-item:last-child {
      border-bottom: none;
    }

    .interval-name {
      font-weight: 500;
    }

    .interval-stats {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .interval-accuracy {
      font-weight: 600;
      min-width: 45px;
      text-align: right;
    }

    .interval-accuracy.good {
      color: #27ae60;
    }

    .interval-accuracy.poor {
      color: #e74c3c;
    }

    .interval-score {
      color: #7f8c8d;
      font-size: 0.9rem;
      min-width: 40px;
      text-align: right;
    }

    .action-buttons {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
    }

    .back-button {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s;
    }

    .back-button:hover {
      background-color: #2980b9;
    }

    .level-tag {
      font-weight: bold;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .easy-level {
      background-color: #3498db;
      color: white;
    }

    .medium-level {
      background-color: #f39c12;
      color: white;
    }

    .hard-level {
      background-color: #e74c3c;
      color: white;
    }

    .mastery-level {
      background-color: #9b59b6;
      color: white;
    }

    .mastery-text {
      font-size: 1.1rem;
      color: #2c3e50;
      padding: 1rem 0;
    }
  `]
})
export class ProgressComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  private userSubscription?: Subscription;

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit() {
    this.userSubscription = this.userService.getCurrentUser().subscribe({
      next: (user) => {
        if (!user) {
          this.router.navigate(['/']);
          return;
        }
        this.currentUser = user;
      },
      error: (error) => {
        console.error('Error loading user data:', error);
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
  }

  getTotalExercises(): number {
    return this.currentUser?.intervalTraining?.totalExercisesCompleted || 0;
  }

  getLastSessionDate(): string {
    const date = this.currentUser?.intervalTraining?.lastSessionDate;
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getOverallAccuracy(): number {
    if (!this.currentUser?.intervalTraining?.progress) return 0;
    const progress = this.currentUser.intervalTraining.progress;
    const totalAttempts = progress.reduce((sum, p) => sum + p.attempts, 0);
    const totalCorrect = progress.reduce((sum, p) => sum + p.correctAttempts, 0);
    return totalAttempts === 0 ? 0 : Math.round((totalCorrect / totalAttempts) * 100);
  }

  getProficiencyLevelDisplay(): string {
    if (!this.currentUser?.intervalTraining?.proficiencyLevel) return 'No Level';
    return this.currentUser.intervalTraining.proficiencyLevel.charAt(0).toUpperCase() + this.currentUser.intervalTraining.proficiencyLevel.slice(1);
  }

  getAccuracyPercentage(level: string): number {
    if (!this.currentUser?.intervalTraining) return 0;
    
    // Access the appropriate accuracy field based on level
    switch (level) {
      case 'easy':
        return Math.round(this.currentUser.intervalTraining.easyIntervalAccuracy * 100);
      case 'medium':
        return Math.round(this.currentUser.intervalTraining.mediumIntervalAccuracy * 100);
      case 'hard':
        return Math.round(this.currentUser.intervalTraining.hardIntervalAccuracy * 100);
      default:
        return 0;
    }
  }

  getAttemptsForCategory(level: string): number {
    if (!this.currentUser?.intervalTraining?.progress) return 0;
    
    // Define which intervals belong to each category
    const categories = {
      'easy': ['Unison', 'Perfect Fourth', 'Perfect Fifth', 'Octave'],
      'medium': ['Major Second', 'Major Third', 'Major Sixth', 'Major Seventh'],
      'hard': ['Minor Second', 'Minor Third', 'Minor Sixth', 'Minor Seventh', 'Tritone']
    };
    
    // Get the appropriate intervals for this level
    const levelIntervals = categories[level as keyof typeof categories] || [];
    
    // Sum attempts for intervals in this category
    return this.currentUser.intervalTraining.progress
      .filter(p => levelIntervals.includes(p.interval))
      .reduce((sum, p) => sum + p.attempts, 0);
  }

  getIntervalDetails(type: string): any[] {
    if (!this.currentUser?.intervalTraining?.progress) return [];
    
    // Define intervals by type
    let intervalsByType: string[] = [];
    
    if (type === 'Perfect') {
      intervalsByType = ['Unison', 'Perfect Fourth', 'Perfect Fifth', 'Octave'];
    } else if (type === 'Major') {
      intervalsByType = ['Major Second', 'Major Third', 'Major Sixth', 'Major Seventh'];
    } else if (type === 'Minor') {
      intervalsByType = ['Minor Second', 'Minor Third', 'Minor Sixth', 'Minor Seventh', 'Tritone'];
    }
    
    // Map progress to detailed interval objects
    return this.currentUser.intervalTraining.progress
      .filter(p => intervalsByType.includes(p.interval))
      .map(p => ({
        name: p.interval,
        accuracy: p.attempts === 0 ? 0 : Math.round((p.correctAttempts / p.attempts) * 100),
        attempts: p.attempts,
        correct: p.correctAttempts,
      }));
  }

  goBack() {
    this.router.navigate(['/']);
  }
} 