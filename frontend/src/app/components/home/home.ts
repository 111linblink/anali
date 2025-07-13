import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {
  archivoSeleccionado: File | null = null;
  datos: any[] = [];
  columnas: string[] = [];
  errorLectura: string | null = null;

  constructor(private router: Router) { }

  onArchivoSeleccionado(event: any) {
    this.archivoSeleccionado = event.target.files[0];
    this.errorLectura = null;

    if (!this.archivoSeleccionado) return;

    const tipoArchivo = this.archivoSeleccionado.name.split('.').pop()?.toLowerCase();

    if (tipoArchivo !== 'csv' && tipoArchivo !== 'xlsx' && tipoArchivo !== 'xls') {
      this.errorLectura = 'Por favor, selecciona un archivo CSV o Excel válido.';
      this.datos = [];
      this.columnas = [];
      return;
    }

    const lector = new FileReader();

    lector.onload = (e: any) => {
      const bstr = e.target.result;

      try {
        if (tipoArchivo === 'csv') {
          const contenido = bstr as string;
          const lineas = contenido.split(/\r?\n/).filter(line => line.trim() !== '');

          if (lineas.length < 3) {
            throw new Error("El archivo CSV debe tener al menos dos filas de encabezado y una de datos");
          }

          const encabezadoTemas = lineas[0].split(',').map(t => t.trim());
          const encabezadoPreguntas = lineas[1].split(',').map(p => p.trim());

          this.columnas = encabezadoPreguntas.map((pregunta, i) => {
            const tema = encabezadoTemas[i];
            if (!tema || tema.toLowerCase().startsWith("unnamed")) return pregunta;
            return `${tema} - ${pregunta}`;
          });

          this.datos = lineas.slice(2).map(linea => {
            const valores = linea.split(',');
            const fila: any = {};
            this.columnas.forEach((col, i) => {
              fila[col] = valores[i]?.trim() || '';
            });
            return fila;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('datos', JSON.stringify(this.datos));
            localStorage.setItem('columnas', JSON.stringify(this.columnas));
          }
        }
      } catch (error: any) {
        this.errorLectura = `Error al procesar archivo: ${error.message}`;
      }
    };

    if (tipoArchivo === 'csv') {
      lector.readAsText(this.archivoSeleccionado, 'utf-8');
    } else {
      lector.readAsBinaryString(this.archivoSeleccionado);
    }
  }

  irAVariables() {
    if (this.datos.length > 0) {
      this.router.navigate(['/variables']);
    }
  }
}
