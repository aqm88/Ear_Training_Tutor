import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { ProficiencyLevel } from '../../models/proficiency-level.enum';
import { Subscription } from 'rxjs';
import * as Tone from 'tone';

interface Note {
  name: string;
  position: number;
  type: 'line' | 'space' | 'ledger';
  accidental?: 'natural' | 'sharp' | 'flat';
  x?: number;  // Store x position for locked notes
  frequency?: number; // Store frequency for playback
}

interface IntervalInfo {
  note: Note;
  interval: string;
  semitones: number;
}

// Categorize intervals by difficulty
const INTERVAL_CATEGORIES = {
  easy: ['Unison', 'Perfect Fourth', 'Perfect Fifth', 'Octave'],
  medium: ['Major Second', 'Major Third', 'Major Sixth', 'Major Seventh'],
  hard: ['Minor Second', 'Minor Third', 'Minor Sixth', 'Minor Seventh', 'Tritone']
};

// Required proficiency percentage to advance to next level
const PROFICIENCY_THRESHOLD = 0.8; // 80%

@Component({
  selector: 'app-interval-training',
  template: `
    <div class="interval-training-page">
      <div class="error-toast" *ngIf="showError">
        <div class="error-message">
          Please create or select a profile before starting training
        </div>
      </div>
      
      <!-- Level Adjustment Notification -->
      <div class="level-adjustment-overlay" *ngIf="showLevelAdjustmentNotification">
        <div class="level-adjustment-dialog">
          <div class="level-adjustment-content">
            <h4>Level Adjusted</h4>
            <p>{{ levelAdjustmentMessage }}</p>
          </div>
          <div class="level-adjustment-actions">
            <button class="level-adjustment-btn" (click)="closeLevelAdjustmentNotification()">
              Continue
            </button>
          </div>
        </div>
      </div>
      
      <!-- Level Unlock Notification -->
      <div class="level-unlock-overlay" *ngIf="showLevelUnlockNotification">
        <div class="level-unlock-dialog">
          <div class="level-unlock-content">
            <h4>Level Unlocked!</h4>
            <p>{{ levelUnlockMessage }}</p>
          </div>
          <div class="level-unlock-actions">
            <button class="level-unlock-btn" (click)="closeLevelUnlockNotification()">
              Continue with New Level
            </button>
          </div>
        </div>
      </div>
      
      <main class="main-content" *ngIf="currentUser">
        <div class="left-panel">
          <div class="level-selection" [ngClass]="selectedLevel">
            <h3>Level Selection</h3>
            <select [ngModel]="selectedLevel" 
                    (ngModelChange)="changeLevel($event)">
              <option [value]="ProficiencyLevel.EASY">Easy Level</option>
              <option [value]="ProficiencyLevel.MEDIUM" [disabled]="!isLevelUnlocked(ProficiencyLevel.MEDIUM)">Medium Level</option>
              <option [value]="ProficiencyLevel.HARD" [disabled]="!isLevelUnlocked(ProficiencyLevel.HARD)">Hard Level</option>
              <option [value]="ProficiencyLevel.MASTERY" [disabled]="!isLevelUnlocked(ProficiencyLevel.MASTERY)">Master Level</option>
            </select>
            
            <div class="unlock-info" *ngIf="getNextUnlockableLevel() !== null">
              <p>Next level to unlock: <strong>{{ getNextUnlockableLevelName() }}</strong></p>
              <p>{{ getUnlockRequirements(getNextUnlockableLevel()) }}</p>
            </div>
          </div>

          <div class="instructions-panel">
            <h3>Instructions</h3>
            <ol>
              <li>Listen to the Base Note to establish the reference tone</li>
              <li>Play the Interval Note (this is the note you'll identify)</li>
              <li>Click on the staff where you think the note is located</li>
              <li>Select whether the note is natural, sharp, or flat</li>
              <li>Click "Submit Answer" to check your response</li>
            </ol>
            <p>Train your ear to recognize intervals by comparing the relationship between the two notes!</p>
          </div>

          <div class="button-container">
            <button class="back-button" (click)="goBackToTraining()">
              ← Back to Training Selection
            </button>
          </div>
        </div>

        <div class="right-panel">
        <div class="sheet-music-container">
          <div class="base-note-container">
            <div class="base-note-display">
              Base Note: {{ baseNote?.name.charAt(0) }}{{ baseNote?.accidental === 'sharp' ? '♯' : (baseNote?.accidental === 'flat' ? '♭' : '') }}{{ baseNote?.name.slice(1) }}
              <button class="play-base-btn" (click)="playBaseNote()">
                Play Base Note
              </button>
            </div>
          </div>

          <div class="interval-note-container">
            <div class="interval-note-display">
              Interval Note: 
              <button class="play-interval-btn" (click)="playIntervalNote()">
                Play Interval Note
              </button>
            </div>
          </div>

          <div class="note-info">
            <div class="note-display" *ngIf="!selectedNote">
              {{ currentNote ? 'Hovering: ' + currentNote.name : 'Hover over staff to see note' }}
            </div>
            <div class="note-display" *ngIf="selectedNote">
              Selected: {{ selectedNote.name }}
            </div>
          </div>
            
          <div class="accidental-controls" *ngIf="selectedNote">
            <div class="accidental-selector">
              <button 
                class="accidental-btn" 
                [class.selected]="selectedNote.accidental === 'natural'"
                (click)="setAccidental('natural')">
                Natural
              </button>
              <button 
                class="accidental-btn" 
                [class.selected]="selectedNote.accidental === 'sharp'"
                (click)="setAccidental('sharp')">
                Sharp (♯)
              </button>
              <button 
                class="accidental-btn" 
                [class.selected]="selectedNote.accidental === 'flat'"
                (click)="setAccidental('flat')">
                Flat (♭)
              </button>
            </div>
            <div class="action-buttons">
              <button class="cancel-btn" (click)="cancelSelection()">
                Cancel Selection
              </button>
              <button class="submit-btn" (click)="submitAnswer()">
                Submit Answer
              </button>
            </div>
          </div>

          <!-- Feedback Dialog -->
          <div class="feedback-dialog-overlay" *ngIf="showFeedbackDialog" (click)="closeFeedbackDialog()">
            <div class="feedback-dialog" [class.correct]="feedbackClass === 'correct'" [class.incorrect]="feedbackClass === 'incorrect'" (click)="$event.stopPropagation()">
              <div class="feedback-content">
                <p>{{ feedbackMessage }}</p>
              </div>
              <div class="feedback-actions">
                <button class="feedback-btn" (click)="closeFeedbackDialog()">
                  {{ feedbackClass === 'correct' ? 'Continue' : 'Try Again' }}
                </button>
              </div>
            </div>
          </div>

          <canvas #sheetMusicCanvas 
                  (mousemove)="onMouseMove($event)"
                  (mouseout)="onMouseOut()"
                  (click)="onCanvasClick($event)">
          </canvas>
        
            <div class="skip-container">
              <button class="skip-exercise-btn" (click)="giveUp()">
                Skip Exercise
              </button>
              <button class="hint-btn" (click)="showHint()">
                Hint
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <!-- Hint Dialog -->
      <div class="hint-dialog-overlay" *ngIf="showHintDialog" (click)="closeHintDialog()">
        <div class="hint-dialog" (click)="$event.stopPropagation()">
          <div class="hint-header">
            <h4>Hint - Level {{currentHintLevel}}/3</h4>
          </div>
          <div class="hint-content">
            <div class="hint-panes">
              <div class="hint-pane" [class.active]="currentHintLevel === 1">
                <p>{{hintLevel1}}</p>
                <button 
                  class="play-semitones-btn" 
                  [disabled]="isPlayingSemitones"
                  (click)="playSemitoneSteps()">
                  <span *ngIf="!isPlayingSemitones">Play Notes Step by Step</span>
                  <span *ngIf="isPlayingSemitones">Playing...</span>
                </button>
              </div>
              <div class="hint-pane" [class.active]="currentHintLevel === 2">
                <p>This interval is a <strong>{{ intervalInfo?.interval }}</strong>.</p>
                <p>There are <strong>{{ Math.abs(intervalInfo?.semitones || 0) }}</strong> semitones between these notes.</p>
              </div>
              <div class="hint-pane" [class.active]="currentHintLevel === 3">
                <p>The note is <strong>{{ getFormattedNoteName(intervalInfo?.note) }}</strong>.</p>
                <button class="play-interval-btn" (click)="playIntervalNote()">
                  Play Interval Note
                </button>
              </div>
            </div>
          </div>
          <div class="hint-navigation">
            <button class="hint-nav-btn prev" 
                    [disabled]="currentHintLevel === 1" 
                    (click)="previousHint()">
              &larr;
            </button>
            <button class="hint-nav-btn next" 
                    [disabled]="currentHintLevel === 3" 
                    (click)="nextHint()">
              &rarr;
            </button>
          </div>
          <div class="hint-actions">
            <button class="hint-btn" (click)="closeHintDialog()">
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .interval-training-page {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: #f5f5f5;
      position: relative;
    }

    .main-content {
      display: flex;
      flex-direction: row;
      justify-content: center;
      gap: 6rem;
      padding: 2rem 0;
      height: auto;
      max-width: 1400px;
      margin: 0 auto;
      width: 90%;
    }

    .left-panel {
      width: 350px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      min-height: 600px;
      flex-shrink: 0;
    }

    .right-panel {
      width: 550px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      min-height: 600px;
      flex-shrink: 0;
      padding-bottom: 0;
    }

    .level-selection {
      background-color: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .level-selection.easy {
      border-top: 4px solid #3498db;
      background-image: linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(52, 152, 219, 0.15) 100%);
    }

    .level-selection.medium {
      border-top: 4px solid #f39c12;
      background-image: linear-gradient(135deg, rgba(243, 156, 18, 0.05) 0%, rgba(243, 156, 18, 0.15) 100%);
    }

    .level-selection.hard {
      border-top: 4px solid #e74c3c;
      background-image: linear-gradient(135deg, rgba(231, 76, 60, 0.05) 0%, rgba(231, 76, 60, 0.15) 100%);
    }

    .level-selection.mastery {
      border-top: 4px solid #9b59b6;
      background-image: linear-gradient(135deg, rgba(155, 89, 182, 0.1) 0%, rgba(52, 152, 219, 0.15) 100%);
    }

    .level-selection h3 {
      margin-top: 0;
      margin-bottom: 1rem;
      color: #333;
      text-align: center;
    }

    .level-selection select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      background-color: white;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 16px 12px;
    }

    .instructions-panel {
      background-color: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    .instructions-panel h3 {
      margin-top: 0;
      margin-bottom: 1rem;
      color: #333;
      text-align: center;
    }

    .instructions-panel ol {
      padding-left: 1.5rem;
      margin-bottom: 1rem;
    }

    .instructions-panel li {
      margin-bottom: 0.5rem;
    }

    .instructions-panel p {
      color: #666;
      font-style: italic;
      text-align: center;
      margin-top: auto;
      padding-top: 1rem;
    }

    .button-container {
      width: 100%;
      margin-top: auto;
    }

    .back-button, .skip-exercise-btn, .hint-btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
      height: 45px;
      width: 100%;
    }

    .back-button {
      background-color: #3498db;
      color: white;
      border: none;
    }

    .back-button:hover {
      background-color: #2980b9;
    }
    
    .skip-exercise-btn {
      background-color: white;
      color: #e74c3c;
      border: 2px solid #e74c3c;
      flex: 1;
    }
    
    .skip-exercise-btn:hover {
      background-color: #e74c3c;
      color: white;
    }
    
    .hint-btn {
      background-color: white;
      color: #3498db;
      border: 2px solid #3498db;
      flex: 1;
    }
    
    .hint-btn:hover {
      background-color: #3498db;
      color: white;
    }

    .sheet-music-container {
      position: relative;
      background-color: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
      flex-grow: 1;
    }

    .controls-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .note-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .note-display {
      background-color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      font-size: 1.2rem;
      width: 100%;
      text-align: center;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
    }

    .accidental-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .accidental-selector {
      display: flex;
      gap: 0.5rem;
    }

    .accidental-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
      transition: all 0.2s;
    }

    .accidental-btn:hover {
      background-color: #f0f0f0;
    }

    .accidental-btn.selected {
      background-color: #3498db;
      color: white;
      border-color: #3498db;
    }

    canvas {
      border: 1px solid #ddd;
      background-color: white;
      cursor: pointer;
    }

    .base-note-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1rem;
    }

    .base-note-display {
      display: flex;
      justify-content: center;
      width: 100%;
      align-items: center;
      gap: 1rem;
      background-color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      font-size: 1.2rem;
    }

    .play-base-btn {
      padding: 0.5rem 1rem;
      border: 2px solid #2ecc71;
      border-radius: 4px;
      background-color: white;
      color: #2ecc71;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .play-base-btn:hover {
      background-color: #2ecc71;
      color: white;
    }

    .interval-note-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 1rem;
    }

    .interval-note-display {
      display: flex;
      width: 100%;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      background-color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      font-size: 1.2rem;
    }

    .interval-info {
      color: #666;
      font-style: italic;
    }

    .play-interval-btn {
      padding: 0.5rem 1rem;
      border: 2px solid #2ecc71;
      border-radius: 4px;
      background-color: white;
      color: #2ecc71;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .play-interval-btn:hover {
      background-color: #2ecc71;
      color: white;
    }

    .action-buttons {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      margin-bottom: 0;
      justify-content: space-between;
      align-items: center;
    }

    .submit-btn, .cancel-btn {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      height: 36px;
      min-width: 120px;
      margin: 0;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .submit-btn {
      border: 1px solid #2ecc71;
      background-color: white;
      color: #2ecc71;
    }

    .submit-btn:hover {
      background-color: #2ecc71;
      color: white;
    }

    .cancel-btn {
      border: 1px solid #e74c3c;
      background-color: white;
      color: #e74c3c;
    }

    .cancel-btn:hover {
      background-color: #e74c3c;
      color: white;
    }

    .feedback-dialog-overlay, .hint-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .feedback-dialog, .hint-dialog {
      background-color: white;
      padding: 1.5rem;
      border-radius: 8px;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      text-align: center;
      position: relative;
    }

    .hint-dialog {
      border-top: 4px solid #3498db;
      width: 90%;
      max-width: 500px;
      padding: 2rem;
      justify-content: center;
    }
    
    .hint-header {
      text-align: center;
      margin-bottom: 1.5rem;
      justify-content: center;
    }
    
    .hint-header h4 {
      margin: 0;
      color: #333;
      font-size: 1.5rem;
    }
    
    .hint-content {
      position: relative;
      overflow: hidden;
      min-height: 150px;
      padding: 3rem 0;
      width: 100%;
      justify-content: center;
    }
    
    .hint-panes {
      width: 100%;
      height: 100%;
      position: relative;
    }
    
    .hint-pane {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 1rem;
    }
    
    .hint-pane p {
      margin: 0 0 1rem 0;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      width: 100%;
      justify-content: center;
    }
    
    .hint-pane.active {
      opacity: 1;
      z-index: 1;
    }
    
    .hint-navigation {
      display: flex;
      justify-content: space-between;
      margin-top: 1.5rem;
      padding: 0 2rem;
    }
    
    .hint-nav-btn {
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1.2rem;
    }
    
    .hint-nav-btn:hover:not([disabled]) {
      background-color: #e0e0e0;
    }
    
    .hint-nav-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .feedback-dialog.correct {
      border-top: 4px solid #2ecc71;
    }

    .feedback-dialog.incorrect {
      border-top: 4px solid #e74c3c;
    }

    .feedback-content {
      padding: 1.5rem;
      text-align: center;
      font-size: 1.1rem;
    }

    .feedback-actions, .hint-actions {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
    }

    .feedback-btn, .hint-dialog .hint-btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      font-size: 1.1rem;
      background-color: #3498db;
      color: white;
      transition: all 0.2s;
      min-width: 120px;
    }

    .feedback-dialog.correct .feedback-btn {
      background-color: #2ecc71;
      color: white;
      border: none;
    }

    .feedback-dialog.correct .feedback-btn:hover {
      background-color: #27ae60;
    }

    .feedback-dialog.incorrect .feedback-btn {
      background-color: #e74c3c;
      color: white;
      border: none;
    }

    .feedback-dialog.incorrect .feedback-btn:hover {
      background-color: #c0392b;
    }

    .unlock-info {
      margin-top: 1rem;
      padding: 0.75rem;
      background-color: #f8f9fa;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    
    .unlock-info p {
      margin: 0.5rem 0;
    }

    .skip-container {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: auto;
      margin-bottom: 0;
    }

    .level-adjustment-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1001;
    }

    .level-adjustment-dialog {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      width: 90%;
      max-width: 400px;
      overflow: hidden;
      border-top: 4px solid #9b59b6;
    }

    .level-adjustment-content {
      padding: 1.5rem;
      text-align: center;
      font-size: 1.1rem;
    }

    .level-adjustment-content h4 {
      margin-top: 0;
      color: #9b59b6;
      font-size: 1.3rem;
      margin-bottom: 1rem;
    }

    .level-adjustment-actions {
      padding: 1rem;
      display: flex;
      justify-content: center;
      border-top: 1px solid #eee;
    }

    .level-adjustment-btn {
      padding: 0.5rem 1.5rem;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      background-color: #9b59b6;
      color: white;
      border: none;
    }

    .level-adjustment-btn:hover {
      background-color: #8e44ad;
    }

    .level-unlock-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1002;
    }

    .level-unlock-dialog {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      width: 90%;
      max-width: 400px;
      overflow: hidden;
      border-top: 4px solid #2ecc71;
    }

    .level-unlock-content {
      padding: 1.5rem;
      text-align: center;
      font-size: 1.1rem;
    }

    .level-unlock-content h4 {
      margin-top: 0;
      color: #2ecc71;
      font-size: 1.5rem;
      margin-bottom: 1rem;
      font-weight: bold;
    }

    .level-unlock-actions {
      padding: 1rem;
      display: flex;
      justify-content: center;
      border-top: 1px solid #eee;
    }

    .level-unlock-btn {
      padding: 0.5rem 1.5rem;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      background-color: #2ecc71;
      color: white;
      border: none;
    }

    .level-unlock-btn:hover {
      background-color: #27ae60;
    }

    .play-semitones-btn, .hint-pane .play-interval-btn {
      margin-top: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      background-color: #2ecc71;
      color: white;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;
      align-self: center;
    }
    
    .play-semitones-btn:hover:not([disabled]), .hint-pane .play-interval-btn:hover {
      background-color: #27ae60;
    }
    
    .play-semitones-btn[disabled] {
      background-color: #95a5a6;
      cursor: not-allowed;
    }
  `]
})
export class IntervalTrainingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sheetMusicCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  currentNote: Note | null = null;
  selectedNote: Note | null = null;
  baseNote: Note | null = null;
  intervalInfo: IntervalInfo | null = null;
  private synth: Tone.Synth | null = null;
  private isPlaying = false;
  feedbackMessage: string | null = null;
  feedbackClass: string = '';
  showFeedbackDialog: boolean = false;
  showHintDialog: boolean = false;
  currentHintLevel: number = 1;
  hintLevel1: string = 'Listen to the steps between the base note and interval note to help identify the interval.';
  Math = Math; // Add Math object reference for template usage
  isPlayingSemitones: boolean = false;
  hintMessage: string = 'Hint functionality will be added soon!';
  currentUser: User | null = null;
  showError = false;
  private userSubscription?: Subscription;
  
  // Add properties for level adjustment notification
  showLevelAdjustmentNotification: boolean = false;
  levelAdjustmentMessage: string = '';
  
  // Add properties for level unlock notification and tracking
  showLevelUnlockNotification: boolean = false;
  levelUnlockMessage: string = '';
  newlyUnlockedLevel: ProficiencyLevel | null = null;
  
  // Properties to track previously unlocked levels
  private previouslyUnlockedLevels: { [key in ProficiencyLevel]?: boolean } = {
    [ProficiencyLevel.EASY]: true, // Easy is always unlocked
    [ProficiencyLevel.MEDIUM]: false,
    [ProficiencyLevel.HARD]: false,
    [ProficiencyLevel.MASTERY]: false
  };
  
  // Staff configuration
  private readonly STAFF_HEIGHT = 200;
  private readonly LINE_SPACING = 12;
  private readonly STAFF_LINES = 5;
  private readonly STAFF_WIDTH = 400;
  
  // Calculate the starting Y position for the staff (will be used for note positions)
  private readonly STAFF_START_Y = (this.STAFF_HEIGHT - (this.STAFF_LINES - 1) * this.LINE_SPACING) / 2;
  
  // Note mapping for treble clef (from bottom to top)
  private readonly NOTE_MAPPING: Note[] = [
    // Each position is calculated as: STAFF_START_Y + (offset * LINE_SPACING/2)
    // LINE_SPACING/2 is used because notes can be on lines or in spaces
    // Negative offsets go up, positive go down
    { 
      name: 'A5', 
      type: 'ledger', 
      position: this.STAFF_START_Y - this.LINE_SPACING, // One ledger line above staff
      frequency: 880.00 
    },
    { 
      name: 'G5', 
      type: 'space', 
      position: this.STAFF_START_Y - this.LINE_SPACING/2, // Space above top line
      frequency: 783.99 
    },
    { 
      name: 'F5', 
      type: 'line', 
      position: this.STAFF_START_Y, // Top line
      frequency: 698.46 
    },
    { 
      name: 'E5', 
      type: 'space', 
      position: this.STAFF_START_Y + this.LINE_SPACING/2, // Space between top two lines
      frequency: 659.25 
    },
    { 
      name: 'D5', 
      type: 'line', 
      position: this.STAFF_START_Y + this.LINE_SPACING, // Second line from top
      frequency: 587.33 
    },
    { 
      name: 'C5', 
      type: 'space', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 1.5, // Middle space
      frequency: 523.25 
    },
    { 
      name: 'B4', 
      type: 'line', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 2, // Middle line
      frequency: 493.88 
    },
    { 
      name: 'A4', 
      type: 'space', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 2.5, // Space below middle line
      frequency: 440.00 
    },
    { 
      name: 'G4', 
      type: 'line', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 3, // Second line from bottom
      frequency: 392.00 
    },
    { 
      name: 'F4', 
      type: 'space', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 3.5, // Space between bottom two lines
      frequency: 349.23 
    },
    { 
      name: 'E4', 
      type: 'line', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 4, // Bottom line
      frequency: 329.63 
    },
    { 
      name: 'D4', 
      type: 'space', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 4.5, // Space below bottom line
      frequency: 293.66 
    },
    { 
      name: 'C4', 
      type: 'ledger', 
      position: this.STAFF_START_Y + this.LINE_SPACING * 5, // Ledger line below staff
      frequency: 261.63 
    }
  ];

  // Expose ProficiencyLevel enum to the template
  ProficiencyLevel = ProficiencyLevel;
  
  // Add this property to track selected level
  selectedLevel: ProficiencyLevel = ProficiencyLevel.EASY;

  // Add a new field to track the user-selected level separately from the user's actual proficiency level
  private userSelectedLevel: ProficiencyLevel | null = null;

  // Add properties to store the current interval information
  private currentIntervalName: string | null = null;
  private currentIntervalSemitones: number | null = null;

  constructor(
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit() {
    let previousUserId: string | null = null;
    
    this.userSubscription = this.userService.getCurrentUser().subscribe(user => {
      if (!user) {
        this.showError = true;
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 3000);
        return;
      }
      
      // Check if user has changed
      if (previousUserId !== null && previousUserId !== user.id) {
        // User changed - reload the component
        this.resetComponentState();
      }
      
      previousUserId = user.id;
      this.currentUser = user;
      this.initializeIntervalProgress();
      
      // Make sure proficiency level is calculated properly for existing users
      this.calculateIntervalAccuracies();
      this.updateProficiencyLevel();
      
      // Initialize the unlocked levels tracking based on current status
      this.initializeUnlockedLevelsTracking();
      
      // Validate user's proficiency level based on current performance
      this.validateUserProficiencyLevel();
      
      // Check for newly unlocked levels
      this.checkForNewlyUnlockedLevels();
      
      // Initialize selectedLevel to match the user's actual proficiency level
      // Convert string to enum value
      // In ngOnInit() or wherever the user data is loaded
      if (this.userSelectedLevel) {
        // If user had previously manually selected a level, restore it
        this.selectedLevel = this.userSelectedLevel;
      } else {
        // Otherwise, use the user's proficiency level from the database
        this.selectedLevel = this.currentUser.intervalTraining.proficiencyLevel as unknown as ProficiencyLevel;
      }
      
      // Generate new exercise when user changes
      if (this.baseNote) {
        this.generateNewExercise();
      }
    });
  }
  
  /**
   * Initialize the tracking of unlocked levels based on current status
   */
  private initializeUnlockedLevelsTracking() {
    if (!this.currentUser) return;
    
    // Initialize the previously unlocked levels based on current unlock status
    this.previouslyUnlockedLevels = {
      [ProficiencyLevel.EASY]: true, // Easy is always unlocked
      [ProficiencyLevel.MEDIUM]: this.isLevelUnlocked(ProficiencyLevel.MEDIUM),
      [ProficiencyLevel.HARD]: this.isLevelUnlocked(ProficiencyLevel.HARD),
      [ProficiencyLevel.MASTERY]: this.isLevelUnlocked(ProficiencyLevel.MASTERY)
    };
  }
  
  /**
   * Check for newly unlocked levels by comparing current unlock status with previous status
   */
  private checkForNewlyUnlockedLevels() {
    if (!this.currentUser) return;
    
    // Check if Medium level was newly unlocked
    if (!this.previouslyUnlockedLevels[ProficiencyLevel.MEDIUM] && this.isLevelUnlocked(ProficiencyLevel.MEDIUM)) {
      this.handleLevelUnlocked(ProficiencyLevel.MEDIUM);
    }
    // Check if Hard level was newly unlocked
    else if (!this.previouslyUnlockedLevels[ProficiencyLevel.HARD] && this.isLevelUnlocked(ProficiencyLevel.HARD)) {
      this.handleLevelUnlocked(ProficiencyLevel.HARD);
    }
    // Check if Mastery level was newly unlocked
    else if (!this.previouslyUnlockedLevels[ProficiencyLevel.MASTERY] && this.isLevelUnlocked(ProficiencyLevel.MASTERY)) {
      this.handleLevelUnlocked(ProficiencyLevel.MASTERY);
    }
    
    // Update previously unlocked levels for next check
    this.previouslyUnlockedLevels = {
      [ProficiencyLevel.EASY]: true,
      [ProficiencyLevel.MEDIUM]: this.isLevelUnlocked(ProficiencyLevel.MEDIUM),
      [ProficiencyLevel.HARD]: this.isLevelUnlocked(ProficiencyLevel.HARD),
      [ProficiencyLevel.MASTERY]: this.isLevelUnlocked(ProficiencyLevel.MASTERY)
    };
  }
  
  /**
   * Handle a newly unlocked level by showing notification and updating selected level and user profile
   */
  private handleLevelUnlocked(level: ProficiencyLevel) {
    if (!this.currentUser) return;
    
    // Store the newly unlocked level
    this.newlyUnlockedLevel = level;
    
    // Update the user's highest achieved level in their profile
    this.updateHighestAchievedLevel(level);
    
    // Create congratulatory message
    this.levelUnlockMessage = `Congratulations! You've unlocked the ${this.getLevelDisplayName(level)} level with your excellent performance. The application will now switch to this new level.`;
    
    // Show the notification
    this.showLevelUnlockNotification = true;
  }
  
  /**
   * Updates the user's profile to record the highest level they have ever unlocked
   * This ensures that even if they temporarily lose access, we track their achievement
   */
  private updateHighestAchievedLevel(level: ProficiencyLevel) {
    if (!this.currentUser?.intervalTraining) return;
    
    const training = this.currentUser.intervalTraining;
    const currentProfileLevel = training.proficiencyLevel as unknown as ProficiencyLevel;
    
    // Check if the newly unlocked level is higher than their current proficiency level
    let shouldUpdate = false;
    
    if (level === ProficiencyLevel.MASTERY && currentProfileLevel !== ProficiencyLevel.MASTERY) {
      training.proficiencyLevel = ProficiencyLevel.MASTERY;
      shouldUpdate = true;
    } 
    else if (level === ProficiencyLevel.HARD && 
             currentProfileLevel !== ProficiencyLevel.HARD && 
             currentProfileLevel !== ProficiencyLevel.MASTERY) {
      training.proficiencyLevel = ProficiencyLevel.HARD;
      shouldUpdate = true;
    }
    else if (level === ProficiencyLevel.MEDIUM && 
             currentProfileLevel !== ProficiencyLevel.MEDIUM && 
             currentProfileLevel !== ProficiencyLevel.HARD && 
             currentProfileLevel !== ProficiencyLevel.MASTERY) {
      training.proficiencyLevel = ProficiencyLevel.MEDIUM;
      shouldUpdate = true;
    }
    
    // Save the updates to the user profile if needed
    if (shouldUpdate) {
      console.log(`Updating user's highest achieved level to ${this.getLevelDisplayName(level)}`);
      this.userService.updateUser(this.currentUser);
    }
  }
  
  /**
   * Close the level unlock notification and switch to the newly unlocked level
   */
  closeLevelUnlockNotification() {
    this.showLevelUnlockNotification = false;
    
    // Switch to the newly unlocked level if there is one
    if (this.newlyUnlockedLevel !== null) {
      this.changeLevel(this.newlyUnlockedLevel);
      this.newlyUnlockedLevel = null;
    }
  }
  
  // Add this new method to reset component state
  private resetComponentState() {
    // Reset all user-specific state
    this.selectedNote = null;
    this.currentNote = null;
    this.feedbackMessage = null;
    this.showFeedbackDialog = false;
    this.showLevelAdjustmentNotification = false;
    this.showLevelUnlockNotification = false;
    this.newlyUnlockedLevel = null;
    
    // If already initialized, regenerate new exercise
    if (this.synth && this.ctx) {
      this.generateNewExercise();
      this.drawStaffAndNotes();
    }
  }

  async ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    canvas.width = this.STAFF_WIDTH;
    canvas.height = this.STAFF_HEIGHT;
    
    // Initialize Tone.js and draw initial state
    Tone.start().then(() => {
      this.synth = new Tone.Synth().toDestination();
      
      // Initialize with a random base note and random accidental
      const randomIndex = Math.floor(Math.random() * this.NOTE_MAPPING.length);
      const accidentals: ('natural' | 'sharp' | 'flat')[] = ['natural', 'sharp', 'flat'];
      const randomAccidental = accidentals[Math.floor(Math.random() * accidentals.length)];

      // Skip accidentals for C and F notes when flat, and B and E notes when sharp
      // This follows standard music theory practices
      const noteName = this.NOTE_MAPPING[randomIndex].name.charAt(0);
      let finalAccidental = randomAccidental;
      if ((noteName === 'C' || noteName === 'F') && randomAccidental === 'flat') {
        finalAccidental = 'natural';
      } else if ((noteName === 'B' || noteName === 'E') && randomAccidental === 'sharp') {
        finalAccidental = 'natural';
      }

      this.baseNote = {
        ...this.NOTE_MAPPING[randomIndex],
        x: 100, // Fixed position for base note - moved more to the left
        accidental: finalAccidental
      };

      // Generate interval note
      this.generateIntervalNote();
      
      this.drawStaffAndNotes();
    });
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    if (this.synth) {
      this.synth.dispose();
    }
  }

  private getNoteWithAccidental(note: Note): string {
    let noteName = note.name.charAt(0);
    const octave = note.name.slice(-1);
    
    if (note.accidental === 'sharp') {
      noteName += '#';
    } else if (note.accidental === 'flat') {
      noteName += 'b';
    }
    
    return noteName + octave;
  }

  async playBaseNote() {
    if (!this.baseNote || !this.synth || this.isPlaying) return;

    this.isPlaying = true;
    const noteName = this.getNoteWithAccidental(this.baseNote);
    
    // Adjust frequency based on accidental
    let frequency = this.baseNote.frequency;
    if (this.baseNote.accidental === 'sharp') {
      frequency = frequency! * Math.pow(2, 1/12); // Multiply by 2^(1/12) to go up one semitone
    } else if (this.baseNote.accidental === 'flat') {
      frequency = frequency! * Math.pow(2, -1/12); // Multiply by 2^(-1/12) to go down one semitone
    }

    // Use either the note name or frequency depending on what works better with the synth
    if (this.baseNote.accidental === 'natural') {
      this.synth.triggerAttackRelease(noteName, "2n");
    } else {
      this.synth.triggerAttackRelease(frequency, "2n");
    }
    
    setTimeout(() => {
      this.isPlaying = false;
    }, 1000);
  }

  private drawStaff() {
    this.ctx.clearRect(0, 0, this.STAFF_WIDTH, this.STAFF_HEIGHT);
    
    const startY = (this.STAFF_HEIGHT - (this.STAFF_LINES - 1) * this.LINE_SPACING) / 2;
    
    // Draw staff lines
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < this.STAFF_LINES; i++) {
      const y = startY + i * this.LINE_SPACING;
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.STAFF_WIDTH, y);
    }
    
    this.ctx.stroke();
    
    // Draw treble clef in black
    this.ctx.fillStyle = '#000';
    this.ctx.font = '65px serif';
    this.ctx.fillText('𝄞', 10, startY + this.LINE_SPACING * 4);
    
    // Uncomment this to debug note positions by drawing a faint guide for each note position
    // this.drawStaffGuides();
  }
  
  // Helper method to visualize all note positions for debugging
  private drawStaffGuides() {
    const startY = ((this.STAFF_HEIGHT - (this.STAFF_LINES - 1) * this.LINE_SPACING) / 2) - this.LINE_SPACING;
    
    // Draw guide lines for each note position
    this.ctx.strokeStyle = 'rgba(200,200,200,0.3)';
    this.ctx.lineWidth = 1;
    
    // Draw guidelines for every possible note position
    for (let i = 0; i < this.NOTE_MAPPING.length; i++) {
      const y = startY + (i * this.LINE_SPACING / 2);
      
      this.ctx.beginPath();
      this.ctx.moveTo(80, y);
      this.ctx.lineTo(this.STAFF_WIDTH - 20, y);
      this.ctx.stroke();
      
      // Add note name label
      this.ctx.fillStyle = 'rgba(100,100,100,0.5)';
      this.ctx.font = '10px sans-serif';
      this.ctx.fillText(this.NOTE_MAPPING[i].name, this.STAFF_WIDTH - 18, y + 4);
    }
  }

  private drawStaffAndNotes() {
    // Clear and draw the staff
    this.drawStaff();
    
    // Draw base note if it exists
    if (this.baseNote) {
      this.drawNote(this.baseNote.x!, this.baseNote.position, false, true);
    }
    
    // Draw selected note if it exists
    if (this.selectedNote) {
      this.drawNote(this.selectedNote.x!, this.selectedNote.position, true, false);
    }
    
    // Draw hover note if it exists and no note is selected
    if (this.currentNote && !this.selectedNote) {
      this.drawNote(this.currentNote.x!, this.currentNote.position, false, false);
    }
  }

  private drawNote(x: number, y: number, isSelected: boolean = false, isBaseNote: boolean = false) {
    const noteX = isSelected && this.selectedNote?.x ? this.selectedNote.x : x;
    
    const startY = ((this.STAFF_HEIGHT - (this.STAFF_LINES - 1) * this.LINE_SPACING) / 2) - this.LINE_SPACING;
    const relativeY = y - startY;
    const positionIndex = Math.round(relativeY / (this.LINE_SPACING / 2));
    const noteInfo = this.NOTE_MAPPING[Math.max(0, Math.min(positionIndex, this.NOTE_MAPPING.length - 1))];
    
    // Draw ledger lines if needed
    if (noteInfo.type === 'ledger') {
      this.ctx.beginPath();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 1;
      
      if (noteInfo.name === 'C4') {
        const ledgerY = startY + (this.LINE_SPACING * 6);
        this.ctx.moveTo(noteX - 10, ledgerY);
        this.ctx.lineTo(noteX + 10, ledgerY);
      } else if (noteInfo.name === 'A5') {
        const ledgerY = startY;
        this.ctx.moveTo(noteX - 10, ledgerY);
        this.ctx.lineTo(noteX + 10, ledgerY);
      }
      this.ctx.stroke();
    }
    
    // Draw note head with appropriate color
    this.ctx.beginPath();
    if (isBaseNote) {
      this.ctx.fillStyle = '#FFD700';
    } else if (isSelected) {
      this.ctx.fillStyle = '#3498db'; // Blue for selected notes
    } else {
      this.ctx.fillStyle = '#000';
    }
    this.ctx.ellipse(noteX, y, 6, 4.5, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw stem with matching color
    this.ctx.beginPath();
    this.ctx.strokeStyle = isBaseNote ? '#FFD700' : (isSelected ? '#3498db' : '#000');
    this.ctx.lineWidth = 1;
    const middleLineY = startY + this.LINE_SPACING * 2;
    if (y >= middleLineY) {
      this.ctx.moveTo(noteX + 6, y);
      this.ctx.lineTo(noteX + 6, y - 35);
    } else {
      this.ctx.moveTo(noteX - 6, y);
      this.ctx.lineTo(noteX - 6, y + 35);
    }
    this.ctx.stroke();

    // Draw accidental if needed
    const note = isBaseNote ? this.baseNote : this.selectedNote;
    if (note?.accidental && note.accidental !== 'natural') {  // Only draw for sharp and flat
      this.ctx.fillStyle = isBaseNote ? '#FFD700' : (isSelected ? '#3498db' : '#000');
      this.ctx.font = '24px serif';
      let accidentalSymbol = '';
      let xOffset = 0;
      switch (note.accidental) {
        case 'sharp':
          accidentalSymbol = '♯';
          xOffset = 8;
          break;
        case 'flat':
          accidentalSymbol = '♭';
          xOffset = 4;
          break;
      }
      if (accidentalSymbol) {
        this.ctx.fillText(accidentalSymbol, noteX - 20, y + xOffset);
      }
    }
  }

  private getNoteFromPosition(y: number): Note {
    // Use the exact same starting Y calculation as in drawNote for consistency
    const startY = ((this.STAFF_HEIGHT - (this.STAFF_LINES - 1) * this.LINE_SPACING) / 2) - this.LINE_SPACING;
    
    // Calculate the closest line or space position
    const relativeY = y - startY;
    const positionIndex = Math.round(relativeY / (this.LINE_SPACING / 2));
    
    // Ensure the index is within bounds
    const boundedIndex = Math.max(0, Math.min(positionIndex, this.NOTE_MAPPING.length - 1));
    const noteInfo = this.NOTE_MAPPING[boundedIndex];
    
    // Calculate the exact Y position for the note (snapped to line or space)
    const snappedY = startY + (boundedIndex * this.LINE_SPACING / 2);
    
    return {
      name: noteInfo.name,
      position: snappedY,
      type: noteInfo.type,
      frequency: noteInfo.frequency
    };
  }

  onMouseMove(event: MouseEvent) {
    if (this.selectedNote) return; // Don't update currentNote if a note is selected
    
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Account for potential canvas scaling
    const canvasWidth = this.canvasRef.nativeElement.width;
    const canvasHeight = this.canvasRef.nativeElement.height;
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    
    // Apply scaling factors if canvas display size differs from actual size
    const scaleX = canvasWidth / displayWidth;
    const scaleY = canvasHeight / displayHeight;
    
    // Apply scaling to coordinates
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    if (canvasX > 80 && canvasX < this.STAFF_WIDTH) {
      const note = this.getNoteFromPosition(canvasY);
      this.currentNote = { ...note, x: canvasX };
      this.drawStaffAndNotes();
    }
  }

  onCanvasClick(event: MouseEvent) {
    if (this.selectedNote) return;
    
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Account for potential canvas scaling
    const canvasWidth = this.canvasRef.nativeElement.width;
    const canvasHeight = this.canvasRef.nativeElement.height;
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    
    // Apply scaling factors if canvas display size differs from actual size
    const scaleX = canvasWidth / displayWidth;
    const scaleY = canvasHeight / displayHeight;
    
    // Apply scaling to coordinates
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    if (canvasX > 80 && canvasX < this.STAFF_WIDTH) {
      const clickedNote = this.getNoteFromPosition(canvasY);
      this.selectedNote = {
        ...clickedNote,
        accidental: 'natural',
        x: canvasX
      };
      this.drawStaffAndNotes();
    }
  }

  setAccidental(accidental: 'natural' | 'sharp' | 'flat') {
    if (this.selectedNote) {
      this.selectedNote.accidental = accidental;
      this.drawStaffAndNotes();
    }
  }

  cancelSelection() {
    this.selectedNote = null;
    this.drawStaffAndNotes();
  }

  onMouseOut() {
    if (!this.selectedNote) {
      this.currentNote = null;
    }
    this.drawStaffAndNotes();
  }

  goBackToTraining() {
    this.router.navigate(['/training']);
  }

  /**
   * Generate a new exercise with random base and interval notes
   */
  private generateNewExercise() {
    // Don't generate a new exercise if the feedback dialog is currently showing
    if (this.showFeedbackDialog) {
      console.log('Skipping exercise generation while feedback dialog is showing');
      return;
    }
    
    // Step 1: Generate a base note
    this.generateBaseNote();
    
    // Step 2: Generate an interval note
    this.generateIntervalNote();
    
    // Redraw the staff
    this.drawStaffAndNotes();
  }
  
  /**
   * Generate a base note for the exercise
   */
  private generateBaseNote() {
    // Set a range of indices in the NOTE_MAPPING for base notes
    // We want notes that are not too high or too low
    const minBaseNoteIndex = 3; // Start a bit above the bottom of the staff
    const maxBaseNoteIndex = 12; // Stay below the top of the staff to leave room for intervals
    
    // Randomly select a base note within the range
    const baseNoteIndex = Math.floor(Math.random() * (maxBaseNoteIndex - minBaseNoteIndex + 1)) + minBaseNoteIndex;
    
    // Grab the note from our mapping
    let baseNote = this.NOTE_MAPPING[baseNoteIndex];
    
    // Add safety check to prevent undefined baseNote
    if (!baseNote) {
      console.error(`Invalid base note index: ${baseNoteIndex}, max valid index is ${this.NOTE_MAPPING.length - 1}`);
      // Fallback to a safe note in the middle
      const safeIndex = Math.min(7, this.NOTE_MAPPING.length - 1);
      baseNote = this.NOTE_MAPPING[safeIndex];
    }
    
    // Randomly decide if the base note should have an accidental
    const shouldHaveAccidental = Math.random() < 0.3; // 30% chance of having an accidental
    
    let accidental: 'natural' | 'sharp' | 'flat' = 'natural';
    if (shouldHaveAccidental) {
      // Randomly choose between sharp and flat
      accidental = Math.random() < 0.5 ? 'sharp' : 'flat';
    }
    
    // Create the base note with consistent x position and the chosen accidental
    this.baseNote = {
      ...baseNote,
      x: 150, // Position on the left side of the staff
      accidental
    };
    
    console.log(`Generated base note: ${this.baseNote.name}${this.baseNote.accidental === 'natural' ? '' : this.baseNote.accidental}`);
  }
  
  /**
   * Generates an interval note from the base note based on user's proficiency level
   */
  private generateIntervalNote() {
    if (!this.baseNote) {
      console.error("Cannot generate interval without a base note");
      return;
    }
    
    // Step 1: Get the intervals available based on user's proficiency
    const selectedInterval = this.selectIntervalByProficiency();
    console.log(`Selected interval: ${selectedInterval}`);
    
    // Step 2: Convert interval name to semitones
    const semitones = this.getIntervalSemitones(selectedInterval);
    console.log(`Selected interval corresponds to ${semitones} semitones`);
    
    // Step 3: Generate the interval note
    this.generateIntervalFromSemitones(semitones, selectedInterval);
  }

  /**
   * Generate an interval note based on semitones from the base note
   */
  private generateIntervalFromSemitones(semitones: number, intervalName: string): void {
    if (!this.baseNote) return;
    
    // Letter positions in the chromatic scale (C = 0, C# = 1, etc.)
    const letterToSemitones: {[key: string]: number} = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };
    
    // Get base note info
    const baseLetter = this.baseNote.name.charAt(0);
    const baseOctave = parseInt(this.baseNote.name.slice(-1));
    
    // Calculate base note's absolute chromatic position
    let basePosition = letterToSemitones[baseLetter];
    if (this.baseNote.accidental === 'sharp') {
      basePosition += 1;
    } else if (this.baseNote.accidental === 'flat') {
      basePosition -= 1;
    }
    
    // Calculate base note's MIDI note number
    const baseAbsolutePosition = basePosition + (baseOctave * 12);
    
    // Define the highest note we want to show on staff (A#5 = MIDI 82)
    const highestAllowedPosition = 82; // A#5
    
    // Try to generate the interval above the base note first
    let targetPosition = baseAbsolutePosition + semitones;
    let direction = "above";
    
    // If that would exceed our highest allowed note, generate below instead
    if (targetPosition > highestAllowedPosition) {
      targetPosition = baseAbsolutePosition - semitones;
      direction = "below";
      console.log(`Interval would exceed staff range, placing below base note`);
    }
    
    // Convert absolute position back to note properties
    const targetOctave = Math.floor(targetPosition / 12);
    const targetChromatic = targetPosition % 12;
    
    // Find the letter and accidental for the target chromatic position
    const noteInfo = this.chromaticPositionToNote(targetChromatic);
    const targetLetter = noteInfo.letter;
    const accidentalNeeded = noteInfo.accidental;
    
    // Look for a matching note in our mapping
    const matchingNotes = this.NOTE_MAPPING.filter(note => 
      note.name.charAt(0) === targetLetter && 
      note.name.slice(-1) === targetOctave.toString()
    );
    
    let intervalNote: Note;
    
    if (matchingNotes.length > 0) {
      // Use the matching note with our calculated accidental
      intervalNote = {
        ...matchingNotes[0],
        x: 250, // Position on staff
        accidental: accidentalNeeded
      };
    } else {
      console.error(`Could not find note ${targetLetter}${targetOctave} in mapping`);
      // Emergency fallback - regenerate exercise
      this.generateNewExercise();
      return;
    }
    
    // Calculate the actual semitones between the two notes to verify
    const actualSemitones = this.calculateSemitonesBetweenNotes(this.baseNote, intervalNote);
    
    // If the interval direction has changed, update the interval name
    const finalIntervalName = direction === "above" ? 
      intervalName : this.getDescendingIntervalName(intervalName);
    
    console.log(`Generated interval: ${this.baseNote.name}${this.baseNote.accidental || ''} to ${intervalNote.name}${intervalNote.accidental || ''}`);
    console.log(`Interval: ${finalIntervalName} (${actualSemitones} semitones), Direction: ${direction}`);
    
    // Store the interval info
    this.intervalInfo = {
      note: intervalNote,
      interval: finalIntervalName,
      semitones: Math.abs(actualSemitones) // Store absolute value of semitones
    };
  }
  
  /**
   * Converts a chromatic position (0-11) to a letter and accidental
   */
  private chromaticPositionToNote(position: number): { letter: string, accidental: 'natural' | 'sharp' | 'flat' } {
    // Standard mapping of positions to notes (preferring sharps)
    const chromaticMap: { [key: number]: { letter: string, accidental: 'natural' | 'sharp' | 'flat' } } = {
      0: { letter: 'C', accidental: 'natural' },
      1: { letter: 'C', accidental: 'sharp' },
      2: { letter: 'D', accidental: 'natural' },
      3: { letter: 'D', accidental: 'sharp' },
      4: { letter: 'E', accidental: 'natural' },
      5: { letter: 'F', accidental: 'natural' },
      6: { letter: 'F', accidental: 'sharp' },
      7: { letter: 'G', accidental: 'natural' },
      8: { letter: 'G', accidental: 'sharp' },
      9: { letter: 'A', accidental: 'natural' },
      10: { letter: 'A', accidental: 'sharp' },
      11: { letter: 'B', accidental: 'natural' }
    };
    
    return chromaticMap[position];
  }
  
  /**
   * Returns the name of the descending version of an interval
   */
  private getDescendingIntervalName(ascendingName: string): string {
    // For most intervals, we just add "Descending" to the name
    return `Descending ${ascendingName}`;
  }
  
  /**
   * Gets the interval name between two notes
   */
  private getIntervalName(baseNote: Note, intervalNote: Note): string {
    // Calculate the semitone difference
    const semitones = this.calculateSemitonesBetweenNotes(baseNote, intervalNote);
    const absoluteSemitones = Math.abs(semitones);
    
    // Map from semitones to interval names
    const intervalNames: {[key: number]: string} = {
      0: 'Unison',
      1: 'Minor Second',
      2: 'Major Second',
      3: 'Minor Third',
      4: 'Major Third',
      5: 'Perfect Fourth',
      6: 'Tritone',
      7: 'Perfect Fifth',
      8: 'Minor Sixth',
      9: 'Major Sixth',
      10: 'Minor Seventh',
      11: 'Major Seventh',
      12: 'Octave'
    };
    
    // Get the basic interval name
    const intervalName = intervalNames[absoluteSemitones] || 'Unknown Interval';
    
    // Add direction if descending
    if (semitones < 0) {
      return `Descending ${intervalName}`;
    }
    
    return intervalName;
  }

  /**
   * Calculates the semitones between two notes
   */
  private calculateSemitonesBetweenNotes(note1: Note, note2: Note): number {
    // Defensive check to avoid "Cannot read properties of undefined" errors
    if (!note1 || !note2 || !note1.name || !note2.name) {
      console.error('Invalid notes passed to calculateSemitonesBetweenNotes', { note1, note2 });
      return 0; // Return a safe default
    }
    
    // Map of letter names to semitone positions in an octave
    const letterToPosition: {[key: string]: number} = {
      'C': 0,
      'D': 2,
      'E': 4,
      'F': 5,
      'G': 7,
      'A': 9,
      'B': 11
    };
    
    // Get letter and octave for both notes
    const letter1 = note1.name.charAt(0);
    const octave1 = parseInt(note1.name.slice(-1));
    const letter2 = note2.name.charAt(0);
    const octave2 = parseInt(note2.name.slice(-1));
    
    // Calculate base semitone positions
    let pos1 = letterToPosition[letter1] + (octave1 * 12);
    let pos2 = letterToPosition[letter2] + (octave2 * 12);
    
    // Adjust for accidentals
    if (note1.accidental === 'sharp') pos1 += 1;
    if (note1.accidental === 'flat') pos1 -= 1;
    if (note2.accidental === 'sharp') pos2 += 1;
    if (note2.accidental === 'flat') pos2 -= 1;
    
    // Return the semitone difference
    return pos2 - pos1;
  }

  private initializeIntervalProgress() {
    if (!this.currentUser?.intervalTraining) {
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

      this.currentUser!.intervalTraining = {
        progress,
        totalExercisesCompleted: 0,
        lastSessionDate: new Date(),
        proficiencyLevel: ProficiencyLevel.EASY, // Start at easy level
        easyIntervalAccuracy: 0,
        mediumIntervalAccuracy: 0,
        hardIntervalAccuracy: 0
      };

      // Save the initialized data
      this.userService.updateUser(this.currentUser!);
    }
  }

  private updateIntervalProgress(isCorrect: boolean) {
    if (!this.currentUser || !this.intervalInfo) return;

    const intervalProgress = this.currentUser.intervalTraining.progress.find(
      p => p.interval === this.intervalInfo!.interval
    );

    if (intervalProgress) {
      intervalProgress.attempts++;
      if (isCorrect) {
        intervalProgress.correctAttempts++;
      }
      intervalProgress.lastPracticed = new Date();
    }

    this.currentUser.intervalTraining.totalExercisesCompleted++;
    this.currentUser.intervalTraining.lastSessionDate = new Date();

    // Calculate accuracy for each interval category
    this.calculateIntervalAccuracies();
    
    // Determine if the user's proficiency level should change
    this.updateProficiencyLevel();

    // Update the user in the service and ensure it's saved
    this.userService.updateUser(this.currentUser);
  }

  /**
   * Calculates accuracy for each interval category (easy, medium, hard)
   */
  private calculateIntervalAccuracies() {
    if (!this.currentUser) return;
    
    const progress = this.currentUser.intervalTraining.progress;
    let easyTotal = 0, easyCorrect = 0;
    let mediumTotal = 0, mediumCorrect = 0;
    let hardTotal = 0, hardCorrect = 0;
    
    // Calculate totals for each category
    progress.forEach(p => {
      if (INTERVAL_CATEGORIES.easy.includes(p.interval)) {
        easyTotal += p.attempts;
        easyCorrect += p.correctAttempts;
      } else if (INTERVAL_CATEGORIES.medium.includes(p.interval)) {
        mediumTotal += p.attempts;
        mediumCorrect += p.correctAttempts;
      } else if (INTERVAL_CATEGORIES.hard.includes(p.interval)) {
        hardTotal += p.attempts;
        hardCorrect += p.correctAttempts;
      }
    });
    
    // Calculate accuracy percentages (avoiding division by zero)
    this.currentUser.intervalTraining.easyIntervalAccuracy = 
      easyTotal > 0 ? easyCorrect / easyTotal : 0;
      
    this.currentUser.intervalTraining.mediumIntervalAccuracy = 
      mediumTotal > 0 ? mediumCorrect / mediumTotal : 0;
      
    this.currentUser.intervalTraining.hardIntervalAccuracy = 
      hardTotal > 0 ? hardCorrect / hardTotal : 0;
  }
  
  /**
   * Updates the user's proficiency level based on interval accuracies
   */
  private updateProficiencyLevel() {
    if (!this.currentUser) return;
    
    const training = this.currentUser.intervalTraining;
    const currentLevel = training.proficiencyLevel;
    
    // Minimum number of attempts required before considering level advancement
    const MIN_ATTEMPTS = 10;
    
    // Get total attempts for each category
    const easyAttempts = this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.easy);
    const mediumAttempts = this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.medium);
    const hardAttempts = this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.hard);
    
    // Determine new level based on accuracies and current level
    if(this.userSelectedLevel === currentLevel) {
      switch (currentLevel) {
        case ProficiencyLevel.EASY:
          // Advance to MEDIUM if easy intervals are mastered
          if (training.easyIntervalAccuracy >= PROFICIENCY_THRESHOLD && easyAttempts >= MIN_ATTEMPTS) {
            training.proficiencyLevel = ProficiencyLevel.MEDIUM;
          }
          break;
          
        case ProficiencyLevel.MEDIUM:
          // Move back to EASY if easy intervals are no longer mastered
          if (training.easyIntervalAccuracy < PROFICIENCY_THRESHOLD && easyAttempts >= MIN_ATTEMPTS) {
            training.proficiencyLevel = ProficiencyLevel.EASY;
          }
          // Advance to HARD if medium intervals are mastered
          else if (training.mediumIntervalAccuracy >= PROFICIENCY_THRESHOLD && mediumAttempts >= MIN_ATTEMPTS) {
            training.proficiencyLevel = ProficiencyLevel.HARD;
          }
          break;
          
        case ProficiencyLevel.HARD:
          // Move back to MEDIUM if medium intervals are no longer mastered
          if (training.mediumIntervalAccuracy < PROFICIENCY_THRESHOLD && mediumAttempts >= MIN_ATTEMPTS) {
            training.proficiencyLevel = ProficiencyLevel.MEDIUM;
          }
          // Advance to MASTERY if hard intervals are mastered
          else if (training.hardIntervalAccuracy >= PROFICIENCY_THRESHOLD && hardAttempts >= MIN_ATTEMPTS) {
            training.proficiencyLevel = ProficiencyLevel.MASTERY;
          }
          break;
          
        case ProficiencyLevel.MASTERY:
          // Move back to HARD if hard intervals are no longer mastered
          if (training.hardIntervalAccuracy < PROFICIENCY_THRESHOLD && hardAttempts >= MIN_ATTEMPTS) {
            training.proficiencyLevel = ProficiencyLevel.HARD;
          }
          break;
      }
    }
  }
  
  /**
   * Gets the total number of attempts for a category of intervals
   */
  private getTotalAttemptsForCategory(category: string[]): number {
    if (!this.currentUser) return 0;
    
    return this.currentUser.intervalTraining.progress
      .filter(p => category.includes(p.interval))
      .reduce((total, p) => total + p.attempts, 0);
  }

  submitAnswer() {
    if (!this.selectedNote || !this.intervalInfo || !this.currentUser) return;

    // Save the current selected level explicitly to ensure it persists
    this.userSelectedLevel = this.selectedLevel;
    
    // Save current interval information before updating
    this.currentIntervalName = this.intervalInfo.interval;
    this.currentIntervalSemitones = this.intervalInfo.semitones;
    
    // Check if the selected note matches the interval note
    const isCorrect = this.notesAreEquivalent(this.selectedNote, this.intervalInfo.note);
    
    // Store previous level just for feedback messages
    const previousLevel = this.currentUser.intervalTraining.proficiencyLevel;
    
    // Update progress for tracking statistics but prevent automatic level advancement
    this.updateIntervalProgressWithoutReset(isCorrect);
    
    // Check if user has newly advanced to mastery level (only for feedback purposes)
    const reachedMastery = previousLevel !== ProficiencyLevel.MASTERY && 
                          this.currentUser.intervalTraining.proficiencyLevel === ProficiencyLevel.MASTERY;
    
    if (isCorrect) {
      let progressMessage = '';
      
      if (reachedMastery) {
        progressMessage = `\n\nCongratulations! You've reached Master Level! You have demonstrated excellent understanding of musical intervals.`;
      } else if (this.userSelectedLevel === ProficiencyLevel.MASTERY) {
        progressMessage = `\n\nYou're practicing at Master Level!`;
      } else {
        // Use the selected level for the feedback message
        const categoryAccuracy = this.getAccuracyForLevel(this.userSelectedLevel);
        const formattedAccuracy = Math.round(categoryAccuracy * 100);
        const displayLevel = this.getLevelDisplayName(this.userSelectedLevel);
        
        progressMessage = `\n\nYou're at ${formattedAccuracy}% accuracy in ${displayLevel} intervals.`;
        
        // Only mention advancement if they're at their actual proficiency level
        if (this.selectedLevel === this.currentUser.intervalTraining.proficiencyLevel) {
          const nextLevel = this.getNextProficiencyLevel();
          const MIN_ATTEMPTS = 10;
          const currentCategory = this.getCategoryForLevel(this.selectedLevel);
          const categoryAttempts = this.getTotalAttemptsForCategory(currentCategory);
          
          if (categoryAccuracy >= PROFICIENCY_THRESHOLD && categoryAttempts < MIN_ATTEMPTS) {
            progressMessage += ` You need ${MIN_ATTEMPTS - categoryAttempts} more practice attempts before advancing to ${nextLevel}.`;
          } else {
            progressMessage += ` Reach 80% to advance to ${nextLevel}!`;
          }
        }
      }
      
      // Use the stored interval information instead of the dynamic this.intervalInfo
      this.feedbackMessage = `Correct! The interval is a ${this.currentIntervalName} (${this.currentIntervalSemitones} semitones).${progressMessage}`;
      this.feedbackClass = 'correct';
      this.showFeedbackDialog = true;
      
      // Only clear selected note on correct answer
      this.selectedNote = null;
    } else {
      // Show incorrect message but don't show the answer
      this.feedbackMessage = `Incorrect. Try again!`;
      this.feedbackClass = 'incorrect';
      this.showFeedbackDialog = true;
    }
    
    // Always redraw the staff
    this.drawStaffAndNotes();
  }
  
  // Create a new method that updates progress without resetting or changing the selected level
  private updateIntervalProgressWithoutReset(isCorrect: boolean) {
    if (!this.currentUser || !this.intervalInfo) return;

    const intervalProgress = this.currentUser.intervalTraining.progress.find(
      p => p.interval === this.intervalInfo!.interval
    );

    if (intervalProgress) {
      intervalProgress.attempts++;
      if (isCorrect) {
        intervalProgress.correctAttempts++;
      }
      intervalProgress.lastPracticed = new Date();
    }

    this.currentUser.intervalTraining.totalExercisesCompleted++;
    this.currentUser.intervalTraining.lastSessionDate = new Date();

    // Calculate accuracy for each interval category 
    this.calculateIntervalAccuracies();
    
    // Only update the user's proficiency level if they're not using a custom level selection
    // This is important for their overall progress tracking
    if (!this.userSelectedLevel || this.selectedLevel === this.currentUser.intervalTraining.proficiencyLevel) {
      this.updateProficiencyLevel();
    }

    // Validate user's proficiency level and selected level
    this.validateUserProficiencyLevel();

    // Check for newly unlocked levels
    this.checkForNewlyUnlockedLevels();

    // Save the changes to the user's progress
    this.userService.updateUser(this.currentUser);
  }

  // Update closeFeedbackDialog to ensure the level is preserved
  closeFeedbackDialog() {
    this.showFeedbackDialog = false;
    
    // If the answer was correct, generate a new exercise
    if (this.feedbackClass === 'correct') {
      // Store the current level before generating a new exercise
      const preservedLevel = this.selectedLevel;
      
      // Generate the new exercise after showing feedback
      try {
        this.generateNewExercise();
      } catch (error) {
        console.error('Error generating new exercise:', error);
        // Reset state to prevent additional errors
        this.baseNote = null;
        this.intervalInfo = null;
      }
      
      // Always restore the exact same level after generating a new exercise
      this.selectedLevel = preservedLevel;
    } else {
      // For incorrect answers, we just close the dialog and let them try again
      // The selected note is preserved from the submitAnswer method
      
      // Ensure the staff is redrawn with the current selection
      this.drawStaffAndNotes();
    }
  }

  // Update the changeLevel method to remember user-selected levels
  changeLevel(level: ProficiencyLevel) {
    if (!this.currentUser) return;
    
    console.log('Changing level to:', level);
    console.log('Level unlocked?', this.isLevelUnlocked(level));
    
    // Only change the level if it's unlocked
    if (this.isLevelUnlocked(level)) {
      console.log('Setting selected level to:', level);
      
      // Record that the user has manually selected a level
      this.userSelectedLevel = level;
      
      // Set the new selected level
      this.selectedLevel = level;
      
      // Update the user's highest achieved level in their profile
      this.updateHighestAchievedLevel(level);
      
      // Reset the component state for the new level
      this.selectedNote = null;
      this.currentNote = null;
      this.feedbackMessage = null;
      this.showFeedbackDialog = false;
      
      // Generate a new exercise appropriate for this level
      this.generateNewExercise();
      this.drawStaffAndNotes();
    } else {
      console.warn('Attempted to select level that is not unlocked:', level);
    }
  }

  /**
   * Gets a display-friendly version of the current proficiency level
   */
  public getProficiencyLevelDisplay(): string {
    if (!this.currentUser) return '';
    
    switch (this.currentUser.intervalTraining.proficiencyLevel) {
      case ProficiencyLevel.EASY: return 'Easy';
      case ProficiencyLevel.MEDIUM: return 'Medium';
      case ProficiencyLevel.HARD: return 'Hard';
      case ProficiencyLevel.MASTERY: return 'Master';
      default: return '';
    }
  }
  
  /**
   * Gets the name of the next proficiency level to display in feedback
   */
  private getNextProficiencyLevel(): string {
    if (!this.currentUser) return '';
    
    switch (this.currentUser.intervalTraining.proficiencyLevel) {
      case ProficiencyLevel.EASY: return 'Medium';
      case ProficiencyLevel.MEDIUM: return 'Hard';
      case ProficiencyLevel.HARD: return 'Master';
      default: return '';
    }
  }
  
  /**
   * Gets the accuracy for the current category of intervals
   */
  private getCurrentCategoryAccuracy(): number {
    if (!this.currentUser) return 0;
    
    switch (this.currentUser.intervalTraining.proficiencyLevel) {
      case ProficiencyLevel.EASY:
        return this.currentUser.intervalTraining.easyIntervalAccuracy;
      case ProficiencyLevel.MEDIUM:
        return this.currentUser.intervalTraining.mediumIntervalAccuracy;
      case ProficiencyLevel.HARD:
        return this.currentUser.intervalTraining.hardIntervalAccuracy;
      default:
        return 0;
    }
  }

  /**
   * Gets the interval category array for the current proficiency level
   */
  private getCurrentIntervalCategory(): string[] {
    if (!this.currentUser) return [];
    
    switch (this.currentUser.intervalTraining.proficiencyLevel) {
      case ProficiencyLevel.EASY:
        return INTERVAL_CATEGORIES.easy;
      case ProficiencyLevel.MEDIUM:
        return INTERVAL_CATEGORIES.medium;
      case ProficiencyLevel.HARD:
        return INTERVAL_CATEGORIES.hard;
      default:
        return [];
    }
  }

  // New helper methods for getting level-specific information
  private getLevelDisplayName(level: ProficiencyLevel): string {
    switch (level) {
      case ProficiencyLevel.EASY: return 'Easy';
      case ProficiencyLevel.MEDIUM: return 'Medium';
      case ProficiencyLevel.HARD: return 'Hard';
      case ProficiencyLevel.MASTERY: return 'Master';
      default: return '';
    }
  }

  private getAccuracyForLevel(level: ProficiencyLevel): number {
    if (!this.currentUser) return 0;
    
    switch (level) {
      case ProficiencyLevel.EASY:
        return this.currentUser.intervalTraining.easyIntervalAccuracy;
      case ProficiencyLevel.MEDIUM:
        return this.currentUser.intervalTraining.mediumIntervalAccuracy;
      case ProficiencyLevel.HARD:
        return this.currentUser.intervalTraining.hardIntervalAccuracy;
      default:
        return 0;
    }
  }

  private getCategoryForLevel(level: ProficiencyLevel): string[] {
    switch (level) {
      case ProficiencyLevel.EASY:
        return INTERVAL_CATEGORIES.easy;
      case ProficiencyLevel.MEDIUM:
        return INTERVAL_CATEGORIES.medium;
      case ProficiencyLevel.HARD:
        return INTERVAL_CATEGORIES.hard;
      default:
        return [];
    }
  }
  
  private notesAreEquivalent(note1: Note, note2: Note): boolean {
    // Get the chromatic positions of both notes
    const pos1 = this.getChromaticPosition(note1);
    const pos2 = this.getChromaticPosition(note2);
    
    // Notes are equivalent if they have the same chromatic position
    return pos1 === pos2;
  }
  
  private getChromaticPosition(note: Note): number {
    const chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = note.name.charAt(0);
    let position = chromaticScale.indexOf(noteName);
    
    // Adjust for accidentals
    if (note.accidental === 'sharp') {
      position = (position + 1) % 12;
    } else if (note.accidental === 'flat') {
      position = (position - 1 + 12) % 12;
    }
    
    // Also consider the octave for complete chromatic position
    const octave = parseInt(note.name.slice(-1));
    return position + (octave * 12);
  }

  // Add these methods to support level selection
  isLevelUnlocked(level: ProficiencyLevel): boolean {
    if (!this.currentUser) return false;
    
    const training = this.currentUser.intervalTraining;
    const MIN_ATTEMPTS = 10;
    
    // Check for each level and ensure prerequisites are met
    switch (level) {
      case ProficiencyLevel.EASY:
        return true; // Easy level is always unlocked
        
      case ProficiencyLevel.MEDIUM:
        // Need to master Easy level
        return training.easyIntervalAccuracy >= PROFICIENCY_THRESHOLD && 
               this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.easy) >= MIN_ATTEMPTS;
               
      case ProficiencyLevel.HARD:
        // Need to master both Easy and Medium levels
        const easyMastered = 
          training.easyIntervalAccuracy >= PROFICIENCY_THRESHOLD && 
          this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.easy) >= MIN_ATTEMPTS;
          
        const mediumMastered = 
          training.mediumIntervalAccuracy >= PROFICIENCY_THRESHOLD && 
          this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.medium) >= MIN_ATTEMPTS;
        
        return easyMastered && mediumMastered;
        
      case ProficiencyLevel.MASTERY:
        // Need to master all previous levels
        const easyMasteredForMastery = 
          training.easyIntervalAccuracy >= PROFICIENCY_THRESHOLD && 
          this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.easy) >= MIN_ATTEMPTS;
          
        const mediumMasteredForMastery = 
          training.mediumIntervalAccuracy >= PROFICIENCY_THRESHOLD && 
          this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.medium) >= MIN_ATTEMPTS;
          
        const hardMastered = 
          training.hardIntervalAccuracy >= PROFICIENCY_THRESHOLD && 
          this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.hard) >= MIN_ATTEMPTS;
        
        return easyMasteredForMastery && mediumMasteredForMastery && hardMastered;
        
      default:
        return false;
    }
  }

  /**
   * Gets the next level that the user can unlock
   */
  getNextUnlockableLevel(): ProficiencyLevel | null {
    if (!this.currentUser) return null;
    
    if (!this.isLevelUnlocked(ProficiencyLevel.MEDIUM)) return ProficiencyLevel.MEDIUM;
    if (!this.isLevelUnlocked(ProficiencyLevel.HARD)) return ProficiencyLevel.HARD;
    if (!this.isLevelUnlocked(ProficiencyLevel.MASTERY)) return ProficiencyLevel.MASTERY;
    
    return null; // All levels are unlocked
  }

  /**
   * Gets the display name for the next unlockable level
   */
  getNextUnlockableLevelName(): string {
    const level = this.getNextUnlockableLevel();
    if (!level) return '';
    
    switch (level) {
      case ProficiencyLevel.MEDIUM: return 'Medium';
      case ProficiencyLevel.HARD: return 'Hard';
      case ProficiencyLevel.MASTERY: return 'Master';
      default: return '';
    }
  }

  /**
   * Gets the requirements text for unlocking a specific level
   */
  getUnlockRequirements(level: ProficiencyLevel | null): string {
    if (!level || !this.currentUser) return '';
    
    const training = this.currentUser.intervalTraining;
    const MIN_ATTEMPTS = 10;
    
    switch (level) {
      case ProficiencyLevel.MEDIUM: {
        const accuracy = Math.round(training.easyIntervalAccuracy * 100);
        const attempts = this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.easy);
        const needsMoreAccuracy = accuracy < PROFICIENCY_THRESHOLD * 100;
        const needsMoreAttempts = attempts < MIN_ATTEMPTS;
        
        if (needsMoreAccuracy && needsMoreAttempts) {
          return `Need ${PROFICIENCY_THRESHOLD * 100}% accuracy on Easy intervals (currently ${accuracy}%) and ${MIN_ATTEMPTS} attempts (currently ${attempts}).`;
        } else if (needsMoreAccuracy) {
          return `Need ${PROFICIENCY_THRESHOLD * 100}% accuracy on Easy intervals (currently ${accuracy}%).`;
        } else if (needsMoreAttempts) {
          return `Need ${MIN_ATTEMPTS} attempts on Easy intervals (currently ${attempts}).`;
        }
        return '';
      }
      case ProficiencyLevel.HARD: {
        const accuracy = Math.round(training.mediumIntervalAccuracy * 100);
        const attempts = this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.medium);
        const needsMoreAccuracy = accuracy < PROFICIENCY_THRESHOLD * 100;
        const needsMoreAttempts = attempts < MIN_ATTEMPTS;
        
        if (needsMoreAccuracy && needsMoreAttempts) {
          return `Need ${PROFICIENCY_THRESHOLD * 100}% accuracy on Medium intervals (currently ${accuracy}%) and ${MIN_ATTEMPTS} attempts (currently ${attempts}).`;
        } else if (needsMoreAccuracy) {
          return `Need ${PROFICIENCY_THRESHOLD * 100}% accuracy on Medium intervals (currently ${accuracy}%).`;
        } else if (needsMoreAttempts) {
          return `Need ${MIN_ATTEMPTS} attempts on Medium intervals (currently ${attempts}).`;
        }
        return '';
      }
      case ProficiencyLevel.MASTERY: {
        const accuracy = Math.round(training.hardIntervalAccuracy * 100);
        const attempts = this.getTotalAttemptsForCategory(INTERVAL_CATEGORIES.hard);
        const needsMoreAccuracy = accuracy < PROFICIENCY_THRESHOLD * 100;
        const needsMoreAttempts = attempts < MIN_ATTEMPTS;
        
        if (needsMoreAccuracy && needsMoreAttempts) {
          return `Need ${PROFICIENCY_THRESHOLD * 100}% accuracy on Hard intervals (currently ${accuracy}%) and ${MIN_ATTEMPTS} attempts (currently ${attempts}).`;
        } else if (needsMoreAccuracy) {
          return `Need ${PROFICIENCY_THRESHOLD * 100}% accuracy on Hard intervals (currently ${accuracy}%).`;
        } else if (needsMoreAttempts) {
          return `Need ${MIN_ATTEMPTS} attempts on Hard intervals (currently ${attempts}).`;
        }
        return '';
      }
      default:
        return '';
    }
  }

  async playIntervalNote() {
    if (!this.intervalInfo || !this.synth || this.isPlaying) return;

    this.isPlaying = true;
    const noteName = this.getNoteWithAccidental(this.intervalInfo.note);
    
    // Adjust frequency based on accidental
    let frequency = this.intervalInfo.note.frequency;
    if (this.intervalInfo.note.accidental === 'sharp') {
      frequency = frequency! * Math.pow(2, 1/12);
    } else if (this.intervalInfo.note.accidental === 'flat') {
      frequency = frequency! * Math.pow(2, -1/12);
    }

    if (this.intervalInfo.note.accidental === 'natural') {
      this.synth.triggerAttackRelease(noteName, "2n");
    } else {
      this.synth.triggerAttackRelease(frequency, "2n");
    }
    
    setTimeout(() => {
      this.isPlaying = false;
    }, 1000);
  }

  /**
   * Selects an interval based on user's proficiency level
   */
  private selectIntervalByProficiency(): string {
    // Use the selected level for interval selection
    const selectedProficiencyLevel = this.selectedLevel;
    const rand = Math.random();
    let availableIntervals: string[] = [];
    
    // Select intervals based on the current level following specified distribution
    switch (selectedProficiencyLevel) {
      case ProficiencyLevel.EASY:
        // Easy level: 100% easy intervals only
        availableIntervals = [...INTERVAL_CATEGORIES.easy];
        break;
        
      case ProficiencyLevel.MEDIUM:
        // Medium level: 80% medium intervals, 20% easy intervals
        if (rand < 0.8) {
          // 80% chance for medium intervals
          availableIntervals = [...INTERVAL_CATEGORIES.medium];
        } else {
          // 20% chance for easy intervals
          availableIntervals = [...INTERVAL_CATEGORIES.easy];
        }
        break;
        
      case ProficiencyLevel.HARD:
        // Hard level: 80% hard intervals, 10% medium intervals, 10% easy intervals
        if (rand < 0.8) {
          // 80% chance for hard intervals
          availableIntervals = [...INTERVAL_CATEGORIES.hard];
        } else if (rand < 0.9) {
          // 10% chance for medium intervals
          availableIntervals = [...INTERVAL_CATEGORIES.medium];
        } else {
          // 10% chance for easy intervals
          availableIntervals = [...INTERVAL_CATEGORIES.easy];
        }
        break;
        
      case ProficiencyLevel.MASTERY:
        // Mastery level: ~33% for each category (equal distribution)
        if (rand < 0.33) {
          availableIntervals = [...INTERVAL_CATEGORIES.hard];
        } else if (rand < 0.67) {
          availableIntervals = [...INTERVAL_CATEGORIES.medium];
        } else {
          availableIntervals = [...INTERVAL_CATEGORIES.easy];
        }
        break;
        
      default:
        // Safety fallback - use easy intervals
        availableIntervals = [...INTERVAL_CATEGORIES.easy];
    }
    
    // Safety check - if no intervals were selected, default to easy
    if (availableIntervals.length === 0) {
      console.warn('No intervals selected in proficiency logic, defaulting to easy intervals');
      availableIntervals = [...INTERVAL_CATEGORIES.easy];
    }
    
    // Randomly select an interval from available ones
    const randomIntervalIndex = Math.floor(Math.random() * availableIntervals.length);
    return availableIntervals[randomIntervalIndex];
  }
  
  /**
   * Gets the number of semitones for a specific interval
   */
  private getIntervalSemitones(interval: string): number {
    const intervalToSemitones: {[key: string]: number} = {
      'Unison': 0,
      'Minor Second': 1,
      'Major Second': 2,
      'Minor Third': 3,
      'Major Third': 4,
      'Perfect Fourth': 5,
      'Tritone': 6,
      'Perfect Fifth': 7,
      'Minor Sixth': 8,
      'Major Sixth': 9,
      'Minor Seventh': 10,
      'Major Seventh': 11,
      'Octave': 12
    };
    
    return intervalToSemitones[interval] || 0;
  }

  giveUp() {
    // If there's no interval info or user, we can't track statistics
    if (!this.intervalInfo || !this.currentUser) return;
    
    // Save current interval information before giving up
    this.currentIntervalName = this.intervalInfo.interval;
    this.currentIntervalSemitones = this.intervalInfo.semitones;
    
    // Count this as a failed attempt (isCorrect = false)
    this.updateIntervalProgressWithoutReset(false);
    
    console.log(`Gave up on ${this.currentIntervalName} interval - counted as failed attempt`);
    
    // Clear any selected note
    this.selectedNote = null;
    
    // Generate a new exercise
    this.generateNewExercise();
    
    // Redraw the staff
    this.drawStaffAndNotes();
  }

  /**
   * Validates and updates user's proficiency level if it's no longer valid
   * This ensures the user profile accurately reflects their current abilities
   * NOTE: This method is used to validate levels when performance drops, but 
   * will not override their highest achieved level - that is preserved separately
   */
  private validateUserProficiencyLevel() {
    if (!this.currentUser) return;
    
    const training = this.currentUser.intervalTraining;
    const currentLevel = training.proficiencyLevel as unknown as ProficiencyLevel;
    let updated = false;
    
    // Check if the current saved proficiency level is still unlocked
    if (!this.isLevelUnlocked(currentLevel)) {
      console.log('User\'s proficiency level is no longer valid due to performance drop');
      
      // Find the highest valid level
      if (this.isLevelUnlocked(ProficiencyLevel.MASTERY) && currentLevel !== ProficiencyLevel.MASTERY) {
        training.proficiencyLevel = ProficiencyLevel.MASTERY;
        updated = true;
      } else if (this.isLevelUnlocked(ProficiencyLevel.HARD) && currentLevel !== ProficiencyLevel.HARD) {
        training.proficiencyLevel = ProficiencyLevel.HARD;
        updated = true;
      } else if (this.isLevelUnlocked(ProficiencyLevel.MEDIUM) && currentLevel !== ProficiencyLevel.MEDIUM) {
        training.proficiencyLevel = ProficiencyLevel.MEDIUM;
        updated = true;
      } else if (currentLevel !== ProficiencyLevel.EASY) {
        training.proficiencyLevel = ProficiencyLevel.EASY;
        updated = true;
      }
      
      // If the user's level was adjusted, save the update
      if (updated) {
        console.log(`Updated user's proficiency level to ${this.getLevelDisplayName(training.proficiencyLevel as unknown as ProficiencyLevel)}`);
        this.userService.updateUser(this.currentUser);
      }
    }
    
    // Also validate the currently selected level
    this.validateSelectedLevel();
  }
  
  /**
   * Validates the currently selected level and adjusts it if needed
   */
  private validateSelectedLevel() {
    if (!this.currentUser) return;
    
    // If current selectedLevel is not unlocked anymore, find the highest unlocked level
    if (!this.isLevelUnlocked(this.selectedLevel)) {
      console.log('Selected level is now locked due to performance drop');
      
      // Find the highest unlocked level
      if (this.isLevelUnlocked(ProficiencyLevel.MASTERY)) {
        this.selectedLevel = ProficiencyLevel.MASTERY;
      } else if (this.isLevelUnlocked(ProficiencyLevel.HARD)) {
        this.selectedLevel = ProficiencyLevel.HARD;
      } else if (this.isLevelUnlocked(ProficiencyLevel.MEDIUM)) {
        this.selectedLevel = ProficiencyLevel.MEDIUM; 
      } else {
        this.selectedLevel = ProficiencyLevel.EASY;
      }
      
      // Update userSelectedLevel to match the validated level
      this.userSelectedLevel = this.selectedLevel;
      
      // Show a notification about the level change using our in-app notification component
      this.levelAdjustmentMessage = `Your selected level has been adjusted to ${this.getLevelDisplayName(this.selectedLevel)} because your performance in previous levels has dropped below the mastery threshold.`;
      this.showLevelAdjustmentNotification = true;
    }
  }
  
  /**
   * Closes the level adjustment notification
   */
  closeLevelAdjustmentNotification() {
    this.showLevelAdjustmentNotification = false;
  }

  // Show the hint dialog
  showHint() {
    this.currentHintLevel = 1;
    this.showHintDialog = true;
  }

  // Close the hint dialog
  closeHintDialog() {
    this.showHintDialog = false;
  }

  // Navigate to next hint level
  nextHint() {
    if (this.currentHintLevel < 3) {
      this.currentHintLevel++;
    }
  }

  // Navigate to previous hint level
  previousHint() {
    if (this.currentHintLevel > 1) {
      this.currentHintLevel--;
    }
  }

  // Play notes from base note to interval note in semitone steps
  async playSemitoneSteps() {
    if (!this.baseNote || !this.intervalInfo || !this.synth || this.isPlayingSemitones) {
      return;
    }
    
    this.isPlayingSemitones = true;
    
    try {
      // Get the base note frequency with accidental adjustment
      let baseFrequency = this.baseNote.frequency || 440;
      if (this.baseNote.accidental === 'sharp') {
        baseFrequency = baseFrequency * Math.pow(2, 1/12); // Adjust up for sharp
      } else if (this.baseNote.accidental === 'flat') {
        baseFrequency = baseFrequency * Math.pow(2, -1/12); // Adjust down for flat
      }
      
      // Get the interval note frequency with accidental adjustment
      let intervalFrequency = this.intervalInfo.note.frequency || 440;
      if (this.intervalInfo.note.accidental === 'sharp') {
        intervalFrequency = intervalFrequency * Math.pow(2, 1/12); // Adjust up for sharp
      } else if (this.intervalInfo.note.accidental === 'flat') {
        intervalFrequency = intervalFrequency * Math.pow(2, -1/12); // Adjust down for flat
      }
      
      // Get semitones difference between base and interval note
      const semitonesDiff = this.intervalInfo.semitones;
      
      // Determine if the interval is ascending or descending
      const isAscending = semitonesDiff > 0;
      const steps = Math.abs(semitonesDiff);
      
      console.log(`Playing ${isAscending ? 'ascending' : 'descending'} interval with ${steps} semitones`);
      console.log(`Base freq: ${baseFrequency}, Interval freq: ${intervalFrequency}`);
      console.log(`Base note: ${this.baseNote.name} ${this.baseNote.accidental || 'natural'}`);
      console.log(`Interval note: ${this.intervalInfo.note.name} ${this.intervalInfo.note.accidental || 'natural'}`);
      
      // Play the base note first
      this.synth.triggerAttackRelease(baseFrequency, "8n");
      await new Promise(resolve => setTimeout(resolve, 800)); // wait between notes
      
      if (steps === 0) {
        return; // No steps to play (unison)
      }
      
      // Calculate the semitone ratio
      const semitoneRatio = Math.pow(intervalFrequency / baseFrequency, 1 / steps);
      
      // Play each semitone step
      let currentFreq = baseFrequency;
      for (let i = 1; i <= steps; i++) {
        // Calculate exact frequency for this step
        if (i === steps) {
          // Ensure the last note is exactly the interval note
          currentFreq = intervalFrequency;
        } else {
          // Calculate intermediate steps
          currentFreq = baseFrequency * Math.pow(semitoneRatio, i);
        }
        
        // Play the note
        this.synth.triggerAttackRelease(currentFreq, "8n");
        await new Promise(resolve => setTimeout(resolve, 600)); // wait between notes
      }
    } finally {
      this.isPlayingSemitones = false;
    }
  }

  // Helper function to format note name with proper accidental symbol
  getFormattedNoteName(note?: Note): string {
    if (!note) return '';
    
    const noteLetter = note.name.charAt(0);
    const octave = note.name.slice(-1);
    let accidentalSymbol = '';
    
    if (note.accidental === 'sharp') {
      accidentalSymbol = '♯';
    } else if (note.accidental === 'flat') {
      accidentalSymbol = '♭';
    }
    
    return `${noteLetter}${accidentalSymbol}${octave}`;
  }

  /**
   * Helper method to adjust the accidental to get the correct chromatic position
   */
  private adjustIntervalAccidental(letterPosition: number, targetPosition: number): 'natural' | 'sharp' | 'flat' {
    const diff = (targetPosition - letterPosition + 12) % 12;
    
    if (diff === 0) {
      return 'natural';
    } else if (diff === 1 || diff === 11) {
      return diff === 1 ? 'sharp' : 'flat';
    } else if (diff === 2 || diff === 10) {
      // Can use double sharp/flat but we'll stick with simpler accidentals
      return diff === 2 ? 'sharp' : 'flat';
    }
    
    // For larger differences, default to natural (though this shouldn't happen)
    return 'natural';
  }

  /**
   * Gets the interval name from semitones
   */
  private getIntervalNameFromSemitones(semitones: number): string {
    const semitonesToInterval: {[key: number]: string} = {
      0: 'Unison',
      1: 'Minor Second',
      2: 'Major Second',
      3: 'Minor Third',
      4: 'Major Third',
      5: 'Perfect Fourth',
      6: 'Tritone',
      7: 'Perfect Fifth',
      8: 'Minor Sixth',
      9: 'Major Sixth',
      10: 'Minor Seventh',
      11: 'Major Seventh',
      12: 'Octave'
    };
    
    return semitonesToInterval[semitones] || 'Unknown Interval';
  }
} 