import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { ProficiencyLevel } from '../models/proficiency-level.enum';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private users = new BehaviorSubject<User[]>([]);
  private currentUser = new BehaviorSubject<User | null>(null);
  private readonly USERS_KEY = 'users';
  private readonly CURRENT_USER_KEY = 'currentUser';

  constructor() {
    this.loadUsers();
  }

  // Get all users
  getUsers(): Observable<User[]> {
    return this.users.asObservable();
  }

  // Get current user
  getCurrentUser(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  // Create a new user
  createUser(name: string): User {
    const intervals = [
      'Unison', 'Minor Second', 'Major Second', 'Minor Third', 'Major Third',
      'Perfect Fourth', 'Tritone', 'Perfect Fifth', 'Minor Sixth', 'Major Sixth',
      'Minor Seventh', 'Major Seventh', 'Octave'
    ];

    const progress = intervals.map(interval => ({
      interval,
      attempts: 0,
      correctAttempts: 0,
      lastPracticed: new Date()
    }));

    const newUser: User = {
      id: this.generateUserId(),
      name,
      createdAt: new Date(),
      lastActive: new Date(),
      intervalTraining: {
        progress,
        totalExercisesCompleted: 0,
        lastSessionDate: new Date(),
        proficiencyLevel: ProficiencyLevel.EASY,
        easyIntervalAccuracy: 0,
        mediumIntervalAccuracy: 0,
        hardIntervalAccuracy: 0
      }
    };

    const currentUsers = this.users.value;
    this.users.next([...currentUsers, newUser]);
    this.saveUsers();
    return newUser;
  }

  // Set current user
  setCurrentUser(user: User | null): void {
    this.currentUser.next(user);
    if (user) {
      user.lastActive = new Date();
      this.saveUsers();
    }
  }

  // Delete a user
  deleteUser(userId: string): void {
    const currentUsers = this.users.value;
    this.users.next(currentUsers.filter(user => user.id !== userId));
    this.saveUsers();

    // If the deleted user was the current user, clear current user
    if (this.currentUser.value?.id === userId) {
      this.setCurrentUser(null);
    }
  }

  // Update a user
  updateUser(updatedUser: User): void {
    const index = this.users.value.findIndex(user => user.id === updatedUser.id);
    if (index !== -1) {
      const currentUsers = this.users.value;
      const updatedUsers = [
        ...currentUsers.slice(0, index),
        {
          ...updatedUser,
          lastActive: new Date()
        },
        ...currentUsers.slice(index + 1)
      ];
      
      this.users.next(updatedUsers);
      this.saveUsers();
      
      if (this.currentUser.value?.id === updatedUser.id) {
        this.currentUser.next(updatedUsers[index]);
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updatedUsers[index]));
      }
    }
  }

  // Load users from local storage
  private loadUsers(): void {
    const savedUsers = localStorage.getItem(this.USERS_KEY);
    if (savedUsers) {
      const users = JSON.parse(savedUsers).map((user: any) => ({
        ...user,
        createdAt: new Date(user.createdAt),
        lastActive: new Date(user.lastActive),
        intervalTraining: user.intervalTraining ? {
          ...user.intervalTraining,
          lastSessionDate: new Date(user.intervalTraining.lastSessionDate),
          progress: user.intervalTraining.progress.map((p: any) => ({
            ...p,
            lastPracticed: new Date(p.lastPracticed)
          })),
          // Convert string to enum for existing users
          proficiencyLevel: user.intervalTraining.proficiencyLevel || ProficiencyLevel.EASY,
          easyIntervalAccuracy: user.intervalTraining.easyIntervalAccuracy || 0,
          mediumIntervalAccuracy: user.intervalTraining.mediumIntervalAccuracy || 0,
          hardIntervalAccuracy: user.intervalTraining.hardIntervalAccuracy || 0
        } : null
      }));
      this.users.next(users);
    }

    const savedCurrentUser = localStorage.getItem(this.CURRENT_USER_KEY);
    if (savedCurrentUser) {
      const currentUser = JSON.parse(savedCurrentUser);
      this.currentUser.next({
        ...currentUser,
        createdAt: new Date(currentUser.createdAt),
        lastActive: new Date(currentUser.lastActive),
        intervalTraining: currentUser.intervalTraining ? {
          ...currentUser.intervalTraining,
          lastSessionDate: new Date(currentUser.intervalTraining.lastSessionDate),
          progress: currentUser.intervalTraining.progress.map((p: any) => ({
            ...p,
            lastPracticed: new Date(p.lastPracticed)
          })),
          // Convert string to enum for existing users
          proficiencyLevel: currentUser.intervalTraining.proficiencyLevel || ProficiencyLevel.EASY,
          easyIntervalAccuracy: currentUser.intervalTraining.easyIntervalAccuracy || 0,
          mediumIntervalAccuracy: currentUser.intervalTraining.mediumIntervalAccuracy || 0,
          hardIntervalAccuracy: currentUser.intervalTraining.hardIntervalAccuracy || 0
        } : null
      });
    }
  }

  // Save users to local storage
  private saveUsers(): void {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users.value));
  }

  // Generate a unique user ID
  private generateUserId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 