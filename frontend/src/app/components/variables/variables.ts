import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; 

@Component({
  selector: 'app-variables',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variables.html',
  styleUrls: ['./variables.css']
})
export class VariablesComponent implements OnInit {
  columnas: string[] = [];
  datos: any[] = [];
  selectedVariables: { [key: string]: boolean } = {};

  // Inyecta Router en el constructor
  constructor(private router: Router) {}

  ngOnInit(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const columnasStr = localStorage.getItem('columnas');
        const datosStr = localStorage.getItem('datos');

        this.columnas = columnasStr ? JSON.parse(columnasStr) : [];
        this.datos = datosStr ? JSON.parse(datosStr) : [];

        this.columnas.forEach(col => this.selectedVariables[col] = false);
      } else {
        throw new Error('localStorage no disponible (SSR)');
      }
    } catch (error) {
      console.warn(error);
      this.columnas = [];
      this.datos = [];
    }
  }

  get variablesSeleccionadas(): string[] {
    return Object.keys(this.selectedVariables).filter(k => this.selectedVariables[k]);
  }

  continuarAnalisis() {
    const seleccionadas = this.variablesSeleccionadas;

    if (typeof window !== 'undefined') {
      localStorage.setItem('variablesSeleccionadas', JSON.stringify(seleccionadas));
    }

    this.router.navigate(['/analizar']);
  }
}
