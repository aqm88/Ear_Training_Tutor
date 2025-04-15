import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-settings',
  template: `
    <div class="settings-container">
      <div class="error-toast" *ngIf="showError">
        <div class="error-message">
          Please create or select a profile before accessing settings
        </div>
      </div>
      
      <div class="settings-content" *ngIf="currentUser">
        <h2>User Settings</h2>
        
        <div class="settings-form">
          <div class="form-group">
            <label for="userName">User Name</label>
            <input 
              type="text" 
              id="userName" 
              [(ngModel)]="editedName" 
              placeholder="Enter your name"
              class="form-input"
            >
          </div>
          
          <div class="button-group">
            <button class="save-button" (click)="saveChanges()" [disabled]="!editedName">
              Save Changes
            </button>
            <button class="cancel-button" (click)="goBack()">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 2rem;
      max-width: 600px;
      margin: 0 auto;
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

    .settings-content {
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

    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-weight: 500;
      color: #2c3e50;
    }

    .form-input {
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      border-color: #3498db;
      outline: none;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1rem;
    }

    .save-button, .cancel-button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: transform 0.2s, background-color 0.2s;
    }

    .save-button {
      background-color: #3498db;
      color: white;
    }

    .save-button:hover:not(:disabled) {
      background-color: #2980b9;
      transform: translateY(-2px);
    }

    .save-button:disabled {
      background-color: #95a5a6;
      cursor: not-allowed;
    }

    .cancel-button {
      background-color: #e74c3c;
      color: white;
    }

    .cancel-button:hover {
      background-color: #c0392b;
      transform: translateY(-2px);
    }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  editedName: string = '';
  showError = false;
  private userSubscription?: Subscription;

  constructor(
    private userService: UserService,
    private router: Router
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
      this.editedName = user.name;
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
  }

  saveChanges() {
    if (!this.currentUser || !this.editedName.trim()) return;
    
    const updatedUser: User = {
      ...this.currentUser,
      name: this.editedName.trim()
    };
    
    this.userService.updateUser(updatedUser);
    this.router.navigate(['/']);
  }

  goBack() {
    this.router.navigate(['/']);
  }
} 