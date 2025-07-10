import { Routes } from '@angular/router';
import { VariablesComponent } from './components/variables/variables';
import { HomeComponent } from './components/home/home';
import { AnalizarComponent } from './components/analizar/analizar';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'variables', component: VariablesComponent },
  { path: 'analizar', component: AnalizarComponent },
  { path: '**', redirectTo: '' }  // para cualquier ruta no encontrada, ir a home
];
