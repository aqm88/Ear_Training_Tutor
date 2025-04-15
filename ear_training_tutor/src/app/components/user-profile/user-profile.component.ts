import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-profile',
  template: `
    <div class="profile-indicator" (click)="toggleDropdown()" [class.active]="isDropdownOpen">
      <div class="current-profile">
        <span class="profile-name">{{ currentUser?.name || 'Select Profile' }}</span>
        <span class="dropdown-arrow">▼</span>
      </div>

      <!-- Dropdown Menu -->
      <div class="dropdown-menu" *ngIf="isDropdownOpen">
        <!-- Existing Users -->
        <div class="dropdown-section" *ngIf="users.length > 0">
          <div class="section-title">Select Profile</div>
          <div class="profile-list">
            <div *ngFor="let user of users" 
                 class="profile-item"
                 [class.active]="currentUser?.id === user.id"
                 [class.confirming-delete]="userToDelete?.id === user.id">
              <div class="profile-info" (click)="selectUser(user); $event.stopPropagation()">
                <div class="profile-details">
                  <span class="name">{{ user.name }}</span>
                  <span class="last-active" [class.hidden]="userToDelete?.id === user.id">Last active: {{ user.lastActive | date:'shortDate' }}</span>
                  <span class="delete-confirmation" *ngIf="userToDelete?.id === user.id">Do you really want to delete this profile and related data?</span>
                </div>
              </div>
              <button class="delete-button" 
                      (click)="deleteUser(user); $event.stopPropagation()"
                      [class.confirm]="userToDelete?.id === user.id"
                      [attr.title]="userToDelete?.id === user.id ? 'Click again to confirm deletion' : 'Delete profile'">
                {{ userToDelete?.id === user.id ? '✓' : '×' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Create New Profile -->
        <div class="dropdown-section">
          <div class="section-title">Create New Profile</div>
          <div class="create-profile" (click)="$event.stopPropagation()">
            <input type="text" 
                   [(ngModel)]="newUserName" 
                   placeholder="Enter name"
                   (keyup.enter)="createUser()">
            <button class="create-button" 
                    (click)="createUser()" 
                    [disabled]="!newUserName.trim()">
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-indicator {
      position: relative;
      display: inline-block;
      padding: 0.75rem 1.25rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      cursor: pointer;
      user-select: none;
      transition: all 0.3s ease;
    }

    .profile-indicator:hover {
      background: #f8f9fa;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .profile-indicator.active {
      background: #f8f9fa;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .current-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .profile-name {
      font-size: 0.95rem;
      color: #2c3e50;
      font-weight: 500;
    }

    .dropdown-arrow {
      font-size: 0.8rem;
      color: #95a5a6;
      transition: transform 0.3s ease;
    }

    .profile-indicator.active .dropdown-arrow {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 0.75rem);
      left: 0;
      min-width: 300px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      overflow: hidden;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-section {
      padding: 1.25rem;
      border-bottom: 1px solid #ecf0f1;
    }

    .dropdown-section:last-child {
      border-bottom: none;
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #7f8c8d;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .profile-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .profile-item {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }

    .profile-item:hover {
      background: #f8f9fa;
    }

    .profile-item.active {
      background: #e8f0fe;
      color: #1a73e8;
    }

    .profile-item.confirming-delete {
      background: #fff5f5;
      border: 1px solid #ffe3e3;
    }

    .profile-item.confirming-delete .profile-info {
      color: #e53e3e;
    }

    .profile-info {
      flex: 1;
      cursor: pointer;
      margin-right: 0.75rem;
      transition: color 0.2s ease;
    }

    .profile-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .name {
      font-weight: 500;
    }

    .last-active {
      font-size: 0.85rem;
      color: #95a5a6;
    }

    .last-active.hidden {
      display: none;
    }

    .delete-confirmation {
      font-size: 0.85rem;
      color: #e53e3e;
      font-weight: 500;
      margin-top: 0.25rem;
    }

    .delete-button {
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: #f0f0f0;
      color: #666;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .delete-button:hover {
      background: #ff4444;
      color: white;
      transform: scale(1.05);
    }

    .delete-button.confirm {
      background: #38a169;
      color: white;
      box-shadow: 0 2px 6px rgba(56, 161, 105, 0.3);
    }

    .create-profile {
      display: flex;
      gap: 0.75rem;
    }

    .create-profile input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }

    .create-profile input::placeholder {
      color: #a0aec0;
    }

    .create-profile input:focus {
      outline: none;
      border-color: #4299e1;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
    }

    .create-button {
      padding: 0.75rem 1.25rem;
      background: #4299e1;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(66, 153, 225, 0.3);
    }

    .create-button:disabled {
      background: #cbd5e0;
      box-shadow: none;
      cursor: not-allowed;
    }

    .create-button:hover:not(:disabled) {
      background: #3182ce;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(66, 153, 225, 0.4);
    }

    .create-button:active:not(:disabled) {
      transform: translateY(0);
    }
  `]
})
export class UserProfileComponent implements OnInit {
  users: User[] = [];
  currentUser: User | null = null;
  newUserName = '';
  isDropdownOpen = false;
  userToDelete: User | null = null;
  deleteTimeout: any;

  constructor(private userService: UserService) {
    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
      if (!e.target || !(e.target as HTMLElement).closest('.profile-indicator')) {
        this.isDropdownOpen = false;
        this.resetDeleteState();
      }
    });
  }

  ngOnInit(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });

    this.userService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (!this.isDropdownOpen) {
      this.resetDeleteState();
    }
  }

  selectUser(user: User): void {
    this.userService.setCurrentUser(user);
    this.isDropdownOpen = false;
    this.resetDeleteState();
  }

  createUser(): void {
    if (this.newUserName.trim()) {
      const newUser = this.userService.createUser(this.newUserName.trim());
      this.userService.setCurrentUser(newUser);
      this.newUserName = '';
      this.isDropdownOpen = false;
    }
  }

  deleteUser(user: User): void {
    if (this.userToDelete?.id === user.id) {
      // Confirm delete
      this.userService.deleteUser(user.id);
      this.resetDeleteState();
    } else {
      // First click - set up confirmation
      this.resetDeleteState();
      this.userToDelete = user;
      
      // Auto-reset after 3 seconds
      this.deleteTimeout = setTimeout(() => {
        this.resetDeleteState();
      }, 3000);
    }
  }

  private resetDeleteState(): void {
    this.userToDelete = null;
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }
  }
} 