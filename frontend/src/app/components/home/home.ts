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

  // Paginación
  paginaActual: number = 0;
  filasPorPagina: number = 10;
  datosPaginados: any[] = [];
  totalPaginas: number = 0;
  paginasVisibles: number[] = [];

  Math = Math;

  constructor(private router: Router) {}

  onArchivoSeleccionado(event: any) {
    this.archivoSeleccionado = event.target.files[0];
    this.errorLectura = null;

    if (!this.archivoSeleccionado) {
      this.resetearDatos();
      return;
    }

    const tipoArchivo = this.archivoSeleccionado.name.split('.').pop()?.toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(tipoArchivo || '')) {
      this.errorLectura = 'Por favor, selecciona un archivo CSV o Excel válido.';
      this.resetearDatos();
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
        } else {
          this.procesarExcel(bstr);
        }

        if (this.datos.length > 0) {
          this.inicializarPaginacion();
          this.guardarEnLocalStorage();
        }

      } catch (error: any) {
        this.errorLectura = `Error al procesar archivo: ${error.message}`;
        this.resetearDatos();
      }
    };

    lector.onerror = () => {
      this.errorLectura = 'Error al leer el archivo. Por favor, intenta nuevamente.';
      this.resetearDatos();
    };

    if (tipoArchivo === 'csv') {
      lector.readAsText(this.archivoSeleccionado, 'utf-8');
    } else {
      lector.readAsBinaryString(this.archivoSeleccionado);
    }
  }

  private procesarExcel(bstr: string) {
    const wb = XLSX.read(bstr, { type: 'binary' });
    const nombreHoja = wb.SheetNames[0];
    const hoja = wb.Sheets[nombreHoja];
    const datosJson: any[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    if (datosJson.length === 0) {
      throw new Error("El archivo Excel está vacío o no contiene datos válidos");
    }

    this.columnas = Object.keys(datosJson[0]);
    this.datos = datosJson.filter(fila =>
      this.columnas.some(col =>
        fila[col] !== null && fila[col] !== undefined && fila[col].toString().trim() !== ''
      )
    );

    if (this.datos.length === 0) {
      throw new Error("No se encontraron datos válidos en el archivo Excel");
    }
  }

  private inicializarPaginacion() {
    this.paginaActual = 0;
    this.calcularPaginacion();
  }

  private calcularPaginacion() {
    this.totalPaginas = Math.ceil(this.datos.length / this.filasPorPagina);
    this.actualizarDatosPaginados();
    this.calcularPaginasVisibles();
  }

  private actualizarDatosPaginados() {
    const inicio = this.paginaActual * this.filasPorPagina;
    const fin = inicio + this.filasPorPagina;
    this.datosPaginados = this.datos.slice(inicio, fin);
  }

  private calcularPaginasVisibles() {
    const maxPaginasVisibles = 5;
    const mitad = Math.floor(maxPaginasVisibles / 2);

    let inicio = Math.max(0, this.paginaActual - mitad);
    let fin = Math.min(this.totalPaginas, inicio + maxPaginasVisibles);

    if (fin - inicio < maxPaginasVisibles) {
      inicio = Math.max(0, fin - maxPaginasVisibles);
    }

    this.paginasVisibles = Array.from({ length: fin - inicio }, (_, i) => inicio + i);
  }

  cambiarFilasPorPagina() {
    this.filasPorPagina = Number(this.filasPorPagina);
    this.paginaActual = 0;
    this.calcularPaginacion();
  }

  irAPagina(pagina: number) {
    if (pagina >= 0 && pagina < this.totalPaginas) {
      this.paginaActual = pagina;
      this.actualizarDatosPaginados();
      this.calcularPaginasVisibles();
    }
  }

  private guardarEnLocalStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('datos', JSON.stringify(this.datos));
        localStorage.setItem('columnas', JSON.stringify(this.columnas));
      } catch (error) {
        console.warn('No se pudo guardar en localStorage:', error);
      }
    }
  }

  private resetearDatos() {
    this.datos = [];
    this.columnas = [];
    this.datosPaginados = [];
    this.paginaActual = 0;
    this.totalPaginas = 0;
    this.paginasVisibles = [];
  }

  irAVariables() {
    if (this.datos.length > 0) {
      this.router.navigate(['/variables'], {
        state: { datos: this.datos, columnas: this.columnas }
      });
    }
  }

  obtenerEstadisticas(): { totalRegistros: number; totalColumnas: number } {
    return {
      totalRegistros: this.datos.length,
      totalColumnas: this.columnas.length
    };
  }

  validarDatos(): boolean {
    if (this.datos.length === 0 || this.columnas.length === 0) {
      return false;
    }
    return this.datos.every(fila =>
      this.columnas.every(col => col in fila)
    );
  }
}
