import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgChartsModule } from 'ng2-charts';
import { Router } from '@angular/router';


interface ChartData {
  labels: string[];
  datasets: { data: number[], label: string }[];
}

interface ChartOptions {
  responsive?: boolean;
  scales?: {
    y?: { beginAtZero?: boolean; max?: number };
  };
}

@Component({
  selector: 'app-variables',
  templateUrl: './variables.html',
  imports: [CommonModule, FormsModule, RouterModule, NgChartsModule],
  styleUrls: ['./variables.css']
})
export class VariablesComponent implements OnInit {
  datos: any[] = [];
  datosOriginales: any[] = [];
  temas: string[] = [];
  preguntasPorTema: { [tema: string]: string[] } = {};
  seleccionTema: { [tema: string]: boolean } = {};
  seleccionPregunta: { [pregunta: string]: boolean } = {};
  temasExpandidos: { [tema: string]: boolean } = {};
  clusterEstimado: number | null = null;
  clusterColor: string = '';
  clusterDescripcion: string = '';
  mapeoClaves: { [claveCompuesta: string]: string } = {};
  columnas: string[] = [];
  selectedVariables: { [key: string]: boolean } = {};

  Math = Math;
  // Propiedades para paginación
  paginaActual: number = 1;
  filasPorPagina: number = 10;
  totalPaginas: number = 0;

  graficaDataset: ChartData = {
    labels: [],
    datasets: [{ data: [], label: 'Promedio por tema' }]
  };

  graficaOpciones: ChartOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, max: 5 }
    }
  };

  // Radar Dataset
  radarDataset: ChartData = {
    labels: [],
    datasets: []
  };

  radarOpciones: ChartOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, max: 5 }
    }
  };

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    const datosStr = localStorage.getItem('datos');
    if (!datosStr) {
      console.error('No se encontraron datos en localStorage');
      return;
    }

    try {
      const datosParseados = JSON.parse(datosStr);
      this.procesarDatosIniciales(datosParseados);
      this.obtenerTemasDesdeBackend();
    } catch (error) {
      console.error('Error parseando datos:', error);
    }
  }

  // FUNCIÓN NUEVA: Limpia los números de identificación y caracteres especiales
  private limpiarNumeros(texto: string): string {
    // Eliminar patrones como -5, -5.1, -5.2, etc.
    let textoLimpio = texto.replace(/\s*-\s*\d+\.?\d*\s*$/, '').trim();
    
    // Limpiar caracteres especiales corruptos
    textoLimpio = this.limpiarCaracteresEspeciales(textoLimpio);
    
    return textoLimpio;
  }

  // FUNCIÓN NUEVA: Limpia caracteres especiales corruptos
  private limpiarCaracteresEspeciales(texto: string): string {
    return texto
      // Eliminar caracteres Unicode corruptos como ï¿½
      .replace(/[ï¿½]/g, '')
      // Eliminar caracteres de control extraños
      .replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F]/g, '')
      // Limpiar espacios múltiples
      .replace(/\s+/g, ' ')
      // Limpiar caracteres especiales al inicio
      .replace(/^[^\w\s]*/, '')
      // Limpiar caracteres especiales al final (excepto signos de puntuación normales)
      .replace(/[^\w\s\?\!\.\,]*$/, '')
      .trim();
  }

  private procesarDatosIniciales(datosParseados: any[]) {
    this.datosOriginales = datosParseados.map((fila: any) => {
      const nuevaFila: any = {};
      for (const key in fila) {
        const valor = fila[key];
        // LIMPIAR LA CLAVE AQUÍ
        const clave = this.limpiarNumeros(key.trim());
        nuevaFila[clave] = isNaN(Number(valor)) ? valor : parseFloat(valor);
      }
      return nuevaFila;
    });

    this.datos = [...this.datosOriginales];
    this.calcularPaginacion();

    console.log('Datos originales procesados:', this.datosOriginales.length, 'filas');
    console.log('Claves disponibles (limpiadas):', Object.keys(this.datosOriginales[0] || {}));
  }

  obtenerTemasDesdeBackend() {
    const csv = this.convertirADatosCSV(this.datosOriginales);
    const blob = new Blob([csv], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'datos.csv');

    this.http.post<any>('http://localhost:8000/temas_preguntas/', formData).subscribe({
      next: (res) => {
        console.log('Respuesta del backend:', res);
        
        this.temas = Object.keys(res.temas);
        
        // LIMPIAR LAS PREGUNTAS QUE VIENEN DEL BACKEND
        this.preguntasPorTema = {};
        for (const tema of this.temas) {
          this.preguntasPorTema[tema] = res.temas[tema].map((pregunta: string) => 
            this.limpiarNumeros(pregunta)
          );
        }

        this.inicializarSelecciones();
        this.crearMapeoClaves();
        this.procesarDatosConMapeo();

        console.log('Temas obtenidos:', this.temas);
        console.log('Preguntas por tema (limpiadas):', this.preguntasPorTema);
        console.log('Mapeo de claves creado:', this.mapeoClaves);

        this.actualizarGrafica();
      },
      error: err => {
        console.error('Error obteniendo temas:', err);
      }
    });
  }

  private inicializarSelecciones() {
    for (let tema of this.temas) {
      this.seleccionTema[tema] = false;
      this.temasExpandidos[tema] = false; // Inicialmente todos collapsed
      for (let pregunta of this.preguntasPorTema[tema]) {
        this.seleccionPregunta[pregunta] = false;
      }
    }
  }

  private crearMapeoClaves() {
    this.mapeoClaves = {};
    const clavesOriginales = Object.keys(this.datosOriginales[0] || {});

    for (const tema of this.temas) {
      for (const pregunta of this.preguntasPorTema[tema]) {
        // Crear clave compuesta SIN el número al final
        const claveCompuesta = `${tema} - ${pregunta}`;
        
        let claveEncontrada = clavesOriginales.find(k => k === pregunta);
        
        if (!claveEncontrada) {
          claveEncontrada = clavesOriginales.find(k => 
            k.toLowerCase().includes(pregunta.toLowerCase()) || 
            pregunta.toLowerCase().includes(k.toLowerCase())
          );
        }

        if (!claveEncontrada) {
          const palabrasPregunta = pregunta.toLowerCase().split(' ');
          claveEncontrada = clavesOriginales.find(k => {
            const claveMinuscula = k.toLowerCase();
            return palabrasPregunta.some(palabra => 
              palabra.length > 3 && claveMinuscula.includes(palabra)
            );
          });
        }

        if (claveEncontrada) {
          this.mapeoClaves[claveCompuesta] = claveEncontrada;
        } else {
          console.warn(`No se encontró mapeo para: ${pregunta}`);
        }
      }
    }
  }

  private limpiarNombrePregunta(pregunta: string): string {
    // Ya no necesitamos limpiar aquí porque ya lo hicimos antes
    return pregunta.trim();
  }

  private procesarDatosConMapeo() {
    this.datos = this.datosOriginales.map((fila: any) => {
      const nuevaFila: any = {};

      for (const key in fila) {
        nuevaFila[key] = fila[key];
      }

      for (const [claveCompuesta, claveOriginal] of Object.entries(this.mapeoClaves)) {
        if (fila.hasOwnProperty(claveOriginal)) {
          nuevaFila[claveCompuesta] = fila[claveOriginal];
        }
      }

      return nuevaFila;
    });

    console.log('Datos procesados con mapeo (primera fila):', this.datos[0]);
  }

  // Métodos de paginación
  calcularPaginacion() {
    this.totalPaginas = Math.ceil(this.datos.length / this.filasPorPagina);
  }

  get datosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.filasPorPagina;
    const fin = inicio + this.filasPorPagina;
    return this.datos.slice(inicio, fin);
  }

  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  get paginasArray(): number[] {
    const paginas = [];
    for (let i = 1; i <= this.totalPaginas; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  // Métodos para manejo de temas expandidos
  toggleTemaExpansion(tema: string) {
    this.temasExpandidos[tema] = !this.temasExpandidos[tema];
  }

  expandirTodosTemas() {
    for (let tema of this.temas) {
      this.temasExpandidos[tema] = true;
    }
  }

  contraerTodosTemas() {
    for (let tema of this.temas) {
      this.temasExpandidos[tema] = false;
    }
  }

  toggleTema(tema: string) {
    const estado = this.seleccionTema[tema];
    for (let pregunta of this.preguntasPorTema[tema]) {
      this.seleccionPregunta[pregunta] = estado;
    }
    this.actualizarGrafica();
  }

  get preguntasSeleccionadas(): string[] {
    const seleccionadas: string[] = [];

    for (let tema of this.temas) {
      for (let pregunta of this.preguntasPorTema[tema]) {
        if (this.seleccionPregunta[pregunta]) {
          const claveCompuesta = `${tema} - ${pregunta}`;
          if (this.mapeoClaves[claveCompuesta] && this.datos.length > 0) {
            seleccionadas.push(claveCompuesta);
          }
        }
      }
    }
    return seleccionadas;
  }

  // Obtener preguntas visibles para mostrar en la tabla
  get preguntasVisibles(): string[] {
    const visibles: string[] = [];
    
    for (let tema of this.temas) {
      for (let pregunta of this.preguntasPorTema[tema]) {
        if (this.seleccionPregunta[pregunta]) {
          const claveCompuesta = `${tema} - ${pregunta}`;
          if (this.mapeoClaves[claveCompuesta]) {
            visibles.push(claveCompuesta);
          }
        }
      }
    }
    return visibles;
  }

  onPreguntaToggle() {
    this.actualizarGrafica();
  }

  actualizarGrafica() {
    const seleccionadas = this.preguntasSeleccionadas;
    
    if (!this.datos.length || seleccionadas.length === 0) {
      this.graficaDataset = { 
        labels: [], 
        datasets: [{ data: [], label: 'Promedio por tema' }] 
      };
      return;
    }

    const temasPromedio: { [tema: string]: number } = {};

    for (const tema of this.temas) {
      const preguntasTema = this.preguntasPorTema[tema]
        .filter(p => this.seleccionPregunta[p])
        .map(p => `${tema} - ${p}`)
        .filter(clave => this.mapeoClaves[clave] && this.datos[0].hasOwnProperty(clave));

      if (preguntasTema.length === 0) continue;

      const valoresPorFila = this.datos.map(row => {
        const valoresFila = preguntasTema.map(clave => {
          const valor = parseFloat(row[clave]);
          return isNaN(valor) ? 0 : valor;
        });
        return valoresFila;
      });

      const promediosPorFila = valoresPorFila.map(valoresFila => {
        if (valoresFila.length === 0) return 0;
        const suma = valoresFila.reduce((a, b) => a + b, 0);
        return suma / valoresFila.length;
      });

      const promedioTema = promediosPorFila.length > 0 ? 
        promediosPorFila.reduce((a, b) => a + b, 0) / promediosPorFila.length : 0;
      
      temasPromedio[tema] = parseFloat(promedioTema.toFixed(2));
    }

    const etiquetas = Object.keys(temasPromedio);
    const datos = Object.values(temasPromedio);

    this.graficaDataset = {
      labels: etiquetas,
      datasets: [{ data: datos, label: 'Promedio por tema' }]
    };

    console.log('Gráfica actualizada:', this.graficaDataset);
    this.realizarPreanalisisPreguntas();
  }

  convertirADatosCSV(datos: any[]): string {
    if (!datos || datos.length === 0) return '';
    
    const columnas = Object.keys(datos[0]);
    const filas = datos.map(row => 
      columnas.map(col => {
        const valor = row[col];
        if (typeof valor === 'string' && (valor.includes(',') || valor.includes('"'))) {
          return `"${valor.replace(/"/g, '""')}"`;
        }
        return valor;
      }).join(',')
    );
    
    return [columnas.join(','), ...filas].join('\n');
  }

  // Métodos de utilidad
  verificarMapeo() {
    console.log('=== INFORMACIÓN DE DEBUG ===');
    console.log('Temas:', this.temas);
    console.log('Preguntas por tema:', this.preguntasPorTema);
    console.log('Mapeo de claves:', this.mapeoClaves);
    
    if (this.datos.length > 0) {
      console.log('Claves disponibles en datos:', Object.keys(this.datos[0]));
      console.log('Primera fila de datos:', this.datos[0]);
    }
    
    console.log('Preguntas seleccionadas:', this.preguntasSeleccionadas);
    console.log('Dataset de gráfica:', this.graficaDataset);
  }

  get estadisticasMapeo() {
    const totalPreguntas = this.temas.reduce((acc, tema) => 
      acc + this.preguntasPorTema[tema].length, 0
    );
    const preguntasMapeadas = Object.keys(this.mapeoClaves).length;
    
    return {
      totalPreguntas,
      preguntasMapeadas,
      porcentajeExito: totalPreguntas > 0 ? 
        ((preguntasMapeadas / totalPreguntas) * 100).toFixed(1) : '0'
    };
  }

  get infoGeneral() {
    return {
      totalFilas: this.datos.length,
      paginaActual: this.paginaActual,
      totalPaginas: this.totalPaginas,
      filasPorPagina: this.filasPorPagina,
      temasExpandidos: Object.values(this.temasExpandidos).filter(Boolean).length,
      totalTemas: this.temas.length
    };
  }

  limpiarPreguntaParaRadar(pregunta: string): string {
    return pregunta.trim();
  }

  realizarPreanalisisPreguntas() {
  const preguntas = this.preguntasSeleccionadas;

  if (!preguntas.length || this.datos.length === 0) return;

  const valores: { [pregunta: string]: number } = {};

  for (const pregunta of preguntas) {
    const respuestas = this.datos
      .map(fila => fila[pregunta])
      .filter(val => !isNaN(val));

    const promedio = respuestas.reduce((a, b) => a + b, 0) / respuestas.length;
    const preguntaLimpia = this.limpiarPreguntaParaRadar(pregunta);
    valores[preguntaLimpia] = parseFloat(promedio.toFixed(2));
  }

  const columnas = Object.keys(valores);
  const fila = columnas.map(k => valores[k]).join(',');
  const csv = columnas.join(',') + '\n' + fila;

  const blob = new Blob([csv], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', blob, 'preanalisis.csv');

  this.http.post<any>('http://localhost:8000/preanalisis/', formData).subscribe({
    next: res => {
      this.clusterEstimado = res.cluster;
      this.clusterColor = ['#007bff', '#28a745', '#ffc107'][res.cluster] || 'gray';
      this.clusterDescripcion = `Grupo estimado con base en tus respuestas.`;

      this.radarDataset = {
        labels: columnas,
        datasets: [{
          data: columnas.map(c => res.valores[c]),
          label: `Tus respuestas (Cluster ${res.cluster})`
        }]
      };
    },
    error: err => {
      console.error('Error en preanálisis:', err);
    }
  });
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
  /*get datosPaginados(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.datos.slice(startIndex, endIndex);
  }*/

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