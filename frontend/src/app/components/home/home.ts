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
          if (lineas.length === 0) throw new Error("Archivo vacío");

          this.columnas = lineas[0].split(',').map(col => col.trim());
          this.datos = lineas.slice(1).map(linea => {
            const valores = linea.split(',');
            const fila: any = {};
            this.columnas.forEach((col, i) => {
              fila[col] = valores[i]?.trim() || '';
            });
            return fila;
          });

        } else {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const nombreHoja = wb.SheetNames[0];
          const hoja = wb.Sheets[nombreHoja];
          const datosJson: any[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });

          if (datosJson.length === 0) throw new Error("El archivo Excel está vacío");

          this.columnas = Object.keys(datosJson[0]);
          this.datos = datosJson;
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('datos', JSON.stringify(this.datos));
          localStorage.setItem('columnas', JSON.stringify(this.columnas));
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
