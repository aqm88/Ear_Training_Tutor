import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { SettingsComponent } from './components/settings/settings.component';
import { TrainingSelectionComponent } from './components/training-selection/training-selection.component';
import { IntervalTrainingComponent } from './components/interval-training/interval-training.component';
import { ProgressComponent } from './components/progress/progress.component';
const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'training', component: TrainingSelectionComponent },
  { path: 'progress', component: ProgressComponent },
  { path: 'interval-training', component: IntervalTrainingComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 