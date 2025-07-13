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
  
  // Propiedades para la paginación
  paginaActual: number = 0;
  filasPorPagina: number = 10;
  datosPaginados: any[] = [];
  totalPaginas: number = 0;
  paginasVisibles: number[] = [];

  // Referencia Math para usar en template
  Math = Math;

  constructor(private router: Router) { }

  onArchivoSeleccionado(event: any) {
    this.archivoSeleccionado = event.target.files[0];
    this.errorLectura = null;

    if (!this.archivoSeleccionado) {
      this.resetearDatos();
      return;
    }

    const tipoArchivo = this.archivoSeleccionado.name.split('.').pop()?.toLowerCase();

    if (tipoArchivo !== 'csv' && tipoArchivo !== 'xlsx' && tipoArchivo !== 'xls') {
      this.errorLectura = 'Por favor, selecciona un archivo CSV o Excel válido.';
      this.resetearDatos();
      return;
    }

    const lector = new FileReader();

    lector.onload = (e: any) => {
      const bstr = e.target.result;

      try {
        if (tipoArchivo === 'csv') {
          this.procesarCSV(bstr);
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

  private procesarCSV(contenido: string) {
    const lineas = contenido.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lineas.length === 0) {
      throw new Error("Archivo vacío");
    }

    if (lineas.length < 2) {
      throw new Error("El archivo debe contener al menos una fila de datos además de los encabezados");
    }

    // Procesamiento mejorado para CSV con manejo de comillas
    this.columnas = this.parsearFilaCSV(lineas[0]);
    this.datos = [];

    for (let i = 1; i < lineas.length; i++) {
      const valores = this.parsearFilaCSV(lineas[i]);
      
      if (valores.length > 0) {
        const fila: any = {};
        this.columnas.forEach((col, index) => {
          fila[col] = valores[index]?.trim() || '';
        });
        this.datos.push(fila);
      }
    }

    if (this.datos.length === 0) {
      throw new Error("No se encontraron datos válidos en el archivo");
    }
  }

  private parsearFilaCSV(linea: string): string[] {
    const resultado: string[] = [];
    let valorActual = '';
    let dentroDeComillas = false;
    
    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];
      
      if (char === '"') {
        dentroDeComillas = !dentroDeComillas;
      } else if (char === ',' && !dentroDeComillas) {
        resultado.push(valorActual.trim());
        valorActual = '';
      } else {
        valorActual += char;
      }
    }
    
    resultado.push(valorActual.trim());
    return resultado;
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
    this.datos = datosJson;

    // Limpiar datos vacíos
    this.datos = this.datos.filter(fila => {
      return this.columnas.some(col => 
        fila[col] !== null && fila[col] !== undefined && fila[col].toString().trim() !== ''
      );
    });

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

  // Método para obtener información de estadísticas básicas
  obtenerEstadisticas(): { totalRegistros: number, totalColumnas: number } {
    return {
      totalRegistros: this.datos.length,
      totalColumnas: this.columnas.length
    };
  }

  // Método para validar la integridad de los datos
  validarDatos(): boolean {
    if (this.datos.length === 0 || this.columnas.length === 0) {
      return false;
    }

    // Verificar que todas las filas tengan las mismas columnas
    return this.datos.every(fila => 
      this.columnas.every(col => col in fila)
    );
  }
}