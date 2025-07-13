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

  constructor(private router: Router) {}

  ngOnInit(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const columnasStr = localStorage.getItem('columnas');
        const datosStr = localStorage.getItem('datos');

        this.columnas = columnasStr ? JSON.parse(columnasStr) : [];
        this.datos = datosStr ? JSON.parse(datosStr) : [];

        this.initializeSelectedVariables();
      } else {
        throw new Error('localStorage no disponible (SSR)');
      }
    } catch (error) {
      console.warn(error);
      this.columnas = [];
      this.datos = [];
      this.initializeSelectedVariables();
    }
  }

  /**
   * Inicializa el objeto selectedVariables con todas las columnas en false
   */
  initializeSelectedVariables(): void {
    this.selectedVariables = {};
    this.columnas.forEach(col => {
      this.selectedVariables[col] = false;
    });
  }

  /**
   * Obtiene las variables que están seleccionadas
   */
  get variablesSeleccionadas(): string[] {
    return Object.keys(this.selectedVariables).filter(k => this.selectedVariables[k]);
  }

  /**
   * Obtiene el número de variables seleccionadas
   */
  getSelectedCount(): number {
    return this.variablesSeleccionadas.length;
  }

  /**
   * Se ejecuta cuando cambia la selección de variables
   * Útil para agregar lógica adicional cuando el usuario selecciona/deselecciona
   */
  updateSelection(): void {
    const seleccionadas = this.variablesSeleccionadas;
    console.log('Variables seleccionadas:', seleccionadas);
    
    // Aquí puedes agregar lógica adicional si necesitas
    // Por ejemplo: validaciones, actualizar otros componentes, etc.
  }

  /**
   * Selecciona todas las variables
   */
  selectAll(): void {
    this.columnas.forEach(col => {
      this.selectedVariables[col] = true;
    });
    this.updateSelection();
  }

  /**
   * Deselecciona todas las variables
   */
  clearSelection(): void {
    this.columnas.forEach(col => {
      this.selectedVariables[col] = false;
    });
    this.updateSelection();
  }

  /**
   * Verifica si todas las variables están seleccionadas
   */
  get allSelected(): boolean {
    return this.columnas.length > 0 && this.columnas.every(col => this.selectedVariables[col]);
  }

  /**
   * Verifica si hay al menos una variable seleccionada
   */
  get hasSelection(): boolean {
    return this.getSelectedCount() > 0;
  }

  /**
   * Continúa con el análisis de las variables seleccionadas
   */
  continuarAnalisis(): void {
    const seleccionadas = this.variablesSeleccionadas;

    if (seleccionadas.length === 0) {
      // Mostrar mensaje de error o notificación
      console.warn('Debe seleccionar al menos una variable para continuar');
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Guardar las variables seleccionadas en localStorage
        localStorage.setItem('variablesSeleccionadas', JSON.stringify(seleccionadas));
        
        // También guardar los datos filtrados para optimizar el siguiente paso
        const datosFiltrados = this.datos.map(fila => {
          const filaFiltrada: any = {};
          seleccionadas.forEach(col => {
            filaFiltrada[col] = fila[col];
          });
          return filaFiltrada;
        });
        
        localStorage.setItem('datosFiltrados', JSON.stringify(datosFiltrados));
        
        console.log(`Navegando a análisis con ${seleccionadas.length} variables:`, seleccionadas);
        
        // Navegar a la página de análisis
        this.router.navigate(['/analizar']);
      } else {
        console.error('localStorage no disponible');
      }
    } catch (error) {
      console.error('Error al guardar datos:', error);
    }
  }

  /**
   * Obtiene el texto descriptivo para el contador de selección
   */
  getSelectionText(): string {
    const count = this.getSelectedCount();
    const total = this.columnas.length;
    
    if (count === 0) {
      return 'Ninguna variable seleccionada';
    } else if (count === 1) {
      return '1 variable seleccionada';
    } else if (count === total) {
      return `Todas las ${total} variables seleccionadas`;
    } else {
      return `${count} de ${total} variables seleccionadas`;
    }
  }

  /**
   * Alterna la selección de una variable específica
   */
  toggleVariable(columna: string): void {
    this.selectedVariables[columna] = !this.selectedVariables[columna];
    this.updateSelection();
  }

  /**
   * Verifica si hay datos disponibles para mostrar
   */
  get hasDatos(): boolean {
    return this.datos && this.datos.length > 0;
  }

  // Propiedades para paginación
  currentPage: number = 1;
  itemsPerPage: number = 10;
  itemsPerPageOptions: number[] = [5, 10, 25, 50];

  /**
   * Obtiene los datos paginados para la vista previa
   */
  get datosPaginados(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.datos.slice(startIndex, endIndex);
  }

  /**
   * Obtiene el número total de páginas
   */
  get totalPages(): number {
    return Math.ceil(this.datos.length / this.itemsPerPage);
  }

  /**
   * Obtiene el array de números de página para mostrar
   */
  get pageNumbers(): number[] {
    const pages: number[] = [];
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;
    
    // Mostrar hasta 5 páginas alrededor de la página actual
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Ajustar si estamos cerca del final
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Obtiene información del rango de datos mostrados
   */
  get dataRange(): string {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.datos.length);
    return `${startIndex}-${endIndex} de ${this.datos.length}`;
  }

  /**
   * Navega a una página específica
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  /**
   * Navega a la página anterior
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  /**
   * Navega a la página siguiente
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  /**
   * Cambia el número de elementos por página
   */
  changeItemsPerPage(newItemsPerPage: number): void {
    this.itemsPerPage = newItemsPerPage;
    this.currentPage = 1; // Resetear a la primera página
  }

  /**
   * Verifica si se puede ir a la página anterior
   */
  get canGoPrevious(): boolean {
    return this.currentPage > 1;
  }

  /**
   * Verifica si se puede ir a la página siguiente
   */
  get canGoNext(): boolean {
    return this.currentPage < this.totalPages;
  }

  /**
   * Resetea la selección y vuelve a la página anterior
   */
  volver(): void {
    this.clearSelection();
    this.router.navigate(['/upload']); // Ajusta la ruta según tu aplicación
  }
}