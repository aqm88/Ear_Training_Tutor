import { ProficiencyLevel } from './proficiency-level.enum';

export interface IntervalProgress {
  interval: string;
  attempts: number;
  correctAttempts: number;
  lastPracticed: Date;
}

export interface IntervalTraining {
  progress: IntervalProgress[];
  totalExercisesCompleted: number;
  lastSessionDate: Date;
  proficiencyLevel: ProficiencyLevel;
  easyIntervalAccuracy: number;
  mediumIntervalAccuracy: number;
  hardIntervalAccuracy: number;
}

export interface User {
  id: string;
  name: string;
  createdAt: Date;
  lastActive: Date;
  intervalTraining: IntervalTraining;
  // We'll add more fields later for tracking progress, settings, etc.
} 