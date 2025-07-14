import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { NgChartsModule } from 'ng2-charts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FormsModule } from '@angular/forms';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Chart, ChartOptions } from 'chart.js';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


interface EstadisticaMedia {
  media: { [key: string]: number };
}
interface Estadistica {
  [cluster: string]: EstadisticaMedia;
}

Chart.register(ChartDataLabels);

@Component({
  selector: 'app-analizar',
  standalone: true,
  imports: [CommonModule, RouterModule, NgChartsModule, FormsModule],
  templateUrl: './analizar.html',
  styleUrls: ['./analizar.css']
})
export class AnalizarComponent implements OnInit, AfterViewInit {
  resultado: any[] = [];
  columnas: string[] = [];
  variablesSeleccionadas: string[] = [];
  centroides: any[] = [];
  conteoClusters: { [key: number]: number } = {};
  estadisticas: Estadistica = {};

  // Variables de paginación
  paginaActual: number = 1;
  filasPorPagina: number = 10; // Puedes ajustar a 5, 20, etc.

  Object = Object;

  // Configuraciones de gráficas mejoradas
  barChartData: any = {};
  barChartOptions: ChartOptions = {};
  radarChartData: any = {};
  radarChartOptions: ChartOptions = {};
  pieChartData: any = {};
  pieChartOptions: ChartOptions = {};
  scatterChartData: any = {};
  scatterOptions: ChartOptions = {};
  bubbleChartData: any = {};
  bubbleOptions: ChartOptions = {};

  // Variables para gráficas 3D
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls: any;
  private animationId: number = 0;

  ejeX: string = '';
  ejeY: string = '';
  ejeZ: string = '';

  tipoExportacion: string = 'centroides';
  formatoExportacion: string = 'pdf';
  ChartDataLabels = ChartDataLabels;

  // Referencias a elementos del DOM
  @ViewChild('barChartCanvas') barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarChartCanvas') radarChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChartCanvas') pieChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scatterChartCanvas') scatterChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('threejsContainer') threejsContainer!: ElementRef<HTMLDivElement>;

  // Colores modernos para los clusters
  private modernColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#8b5a8c'
  ];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    const datosStr = localStorage.getItem('datos');
    const columnasStr = localStorage.getItem('columnas');
    const variablesStr = localStorage.getItem('variablesSeleccionadas');

    if (!datosStr || !columnasStr || !variablesStr) {
      console.error('Faltan datos en localStorage');
      return;
    }

    const datos = JSON.parse(datosStr);
    const columnas = JSON.parse(columnasStr);
    const variables = JSON.parse(variablesStr);

    this.variablesSeleccionadas = variables;

    if (this.variablesSeleccionadas.length >= 3) {
      [this.ejeX, this.ejeY, this.ejeZ] = this.variablesSeleccionadas.slice(0, 3);
    } else if (this.variablesSeleccionadas.length >= 2) {
      [this.ejeX, this.ejeY] = this.variablesSeleccionadas.slice(0, 2);
      this.ejeZ = this.variablesSeleccionadas[2] || this.variablesSeleccionadas[0];
    } else {
      this.ejeX = this.variablesSeleccionadas[0] || '';
      this.ejeY = this.variablesSeleccionadas[1] || this.variablesSeleccionadas[0];
      this.ejeZ = this.variablesSeleccionadas[2] || this.variablesSeleccionadas[0];
    }

    this.enviarDatosAlBackend(datos, variables, 3);
  }

  ngAfterViewInit(): void {
    // Inicializar Three.js después de que la vista esté lista
    setTimeout(() => {
      this.initThreeJS();
    }, 100);
  }

  enviarDatosAlBackend(datos: any[], variables: string[], k: number) {
    const csv = this.convertirADatosCSV(datos);
    const blob = new Blob([csv], { type: 'text/csv' });

    const formData = new FormData();
    formData.append('file', blob, 'datos.csv');
    formData.append('variables', variables.join(','));
    formData.append('k', k.toString());

    this.http.post<any>('http://localhost:8000/analizar/', formData).subscribe({
      next: (res) => {
        this.resultado = res.resultado;
        this.columnas = res.columnas;
        this.centroides = res.centroides;
        this.conteoClusters = res.conteo_clusters;
        this.estadisticas = res.estadisticas;
        this.prepararGraficasModernas();
        this.crear3DScatterPlot();
      },
      error: (err) => console.error('Error en análisis:', err)
    });
  }

  convertirADatosCSV(datos: any[]): string {
    const columnas = Object.keys(datos[0]);
    const filas = datos.map(row =>
      columnas.map(col => JSON.stringify(row[col] ?? '')).join(',')
    );
    return [columnas.join(','), ...filas].join('\n');
  }

  prepararGraficasModernas() {
    const clusters = Object.keys(this.conteoClusters);
    const cantidades = Object.values(this.conteoClusters);

    // Configuración moderna para gráfica de barras
    this.barChartData = {
      labels: clusters.map(c => `Cluster ${c}`),
      datasets: [{
        label: 'Individuos por Cluster',
        data: cantidades,
        backgroundColor: this.modernColors.slice(0, clusters.length).map(color => color + '80'),
        borderColor: this.modernColors.slice(0, clusters.length),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    };

    this.barChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14, weight: 'bold' },
            color: '#374151'
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#374151',
          font: { weight: 'bold' },
          formatter: (value) => value.toLocaleString()
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 }, color: '#6b7280' }
        },
        y: {
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 12 }, color: '#6b7280' }
        }
      }
    };

    // Configuración moderna para gráfica de radar
    const radarLabels = this.variablesSeleccionadas;
    const radarDatasets = Object.entries(this.estadisticas).map(([cluster, stats], index) => ({
      label: `Cluster ${cluster}`,
      data: radarLabels.map(label => stats.media[label]),
      fill: true,
      backgroundColor: this.modernColors[index % this.modernColors.length] + '20',
      borderColor: this.modernColors[index % this.modernColors.length],
      pointBackgroundColor: this.modernColors[index % this.modernColors.length],
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: this.modernColors[index % this.modernColors.length],
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8
    }));

    this.radarChartData = {
      labels: radarLabels,
      datasets: radarDatasets
    };

    this.radarChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14, weight: 'bold' },
            color: '#374151'
          }
        },
        datalabels: { display: false }
      },
      scales: {
        r: {
          angleLines: { color: '#e5e7eb' },
          grid: { color: '#f3f4f6' },
          pointLabels: {
            font: { size: 12, weight: 'bold' },
            color: '#374151'
          },
          ticks: { color: '#6b7280' }
        }
      }
    };

    // Configuración moderna para gráfica de pastel
    this.pieChartData = {
      labels: clusters.map(c => `Cluster ${c}`),
      datasets: [{
        data: cantidades,
        backgroundColor: this.modernColors.slice(0, clusters.length).map(color => color + '90'),
        borderColor: this.modernColors.slice(0, clusters.length),
        borderWidth: 3,
        hoverOffset: 15
      }]
    };

    this.pieChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { size: 14, weight: 'bold' },
            color: '#374151',
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        datalabels: {
          color: '#fff',
          font: { size: 14, weight: 'bold' },
          formatter: (value, context) => {
            const total = context.chart.data.datasets[0].data.reduce((a: any, b: any) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${percentage}%`;
          }
        }
      }
    };

    this.actualizarGraficoDispersion();
  }

  actualizarGraficoDispersion(): void {
    const grupos: { [key: string]: any[] } = {};

    this.resultado.forEach(row => {
      const grupo = row['grupo'];
      const xRaw = row[this.ejeX];
      const yRaw = row[this.ejeY];
      const x = parseFloat(xRaw);
      const y = parseFloat(yRaw);

      if (!grupo || isNaN(x) || isNaN(y)) return;

      if (!grupos[grupo]) grupos[grupo] = [];
      grupos[grupo].push({ x, y });
    });

    this.scatterChartData = {
      datasets: Object.entries(grupos).map(([grupo, puntos], index) => ({
        label: `Cluster ${grupo}`,
        data: puntos,
        backgroundColor: this.modernColors[index % this.modernColors.length] + '80',
        borderColor: this.modernColors[index % this.modernColors.length],
        pointRadius: 8,
        pointHoverRadius: 12,
        borderWidth: 2
      }))
    };

    this.scatterOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14, weight: 'bold' },
            color: '#374151',
            usePointStyle: true
          }
        },
        datalabels: { display: false }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: this.ejeX,
            font: { size: 14, weight: 'bold' },
            color: '#374151'
          },
          grid: { color: '#f3f4f6' },
          ticks: { color: '#6b7280' }
        },
        y: {
          title: {
            display: true,
            text: this.ejeY,
            font: { size: 14, weight: 'bold' },
            color: '#374151'
          },
          grid: { color: '#f3f4f6' },
          ticks: { color: '#6b7280' }
        }
      }
    };

    // Actualizar gráfica 3D si está inicializada
    if (this.scene) {
      this.crear3DScatterPlot();
    }
  }

  // Inicializar Three.js
   initThreeJS(): void {
    if (!this.threejsContainer) return;

    const container = this.threejsContainer.nativeElement;
    const width = container.clientWidth;
    const height = 400;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8fafc);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(10, 10, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Luz ambiental y direccional
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Controles OrbitControls para rotar/zoom/pan
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;

    this.animate();
  }

  crearEjes(): void {
    const container = this.threejsContainer?.nativeElement;
    if (!container) return;

    // Limpiar ejes anteriores (para evitar duplicados)
    const toRemove = this.scene.children.filter(
      (child) => child.userData['tipo'] === 'eje' || child.userData['tipo'] === 'label'
    );
    toRemove.forEach(child => this.scene.remove(child));

    // Calculamos ejeLength dinámico según datos (opcional)
    const valoresX = this.resultado.map(r => parseFloat(r[this.ejeX]) || 0);
    const valoresY = this.resultado.map(r => parseFloat(r[this.ejeY]) || 0);
    const valoresZ = this.resultado.map(r => parseFloat(r[this.ejeZ]) || 0);

    const maxX = Math.max(...valoresX, 10);
    const maxY = Math.max(...valoresY, 10);
    const maxZ = Math.max(...valoresZ, 10);

    const axisLength = Math.max(maxX, maxY, maxZ) * 1.2;

    // Eje X
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    xAxis.userData['tipo'] = 'eje';
    this.scene.add(xAxis);

    // Eje Y
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, axisLength, 0)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    yAxis.userData['tipo'] = 'eje';
    this.scene.add(yAxis);

    // Eje Z
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, axisLength)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Line(zGeometry, zMaterial);
    zAxis.userData['tipo'] = 'eje';
    this.scene.add(zAxis);

    // Ahora agregamos etiquetas 3D con FontLoader y TextGeometry
    const loader = new FontLoader();
    loader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
      const crearEtiqueta = (texto: string, posicion: THREE.Vector3, color: number) => {
        const geom = new TextGeometry(texto, {
          font,
          size: axisLength * 0.05, // tamaño relativo al eje
          depth: 0.05,
          curveSegments: 12,
        });
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(posicion);
        mesh.userData['tipo'] = 'label';
        this.scene.add(mesh);
      };

      crearEtiqueta(this.ejeX || 'X', new THREE.Vector3(axisLength + axisLength * 0.03, 0, 0), 0xff0000);
      crearEtiqueta(this.ejeY || 'Y', new THREE.Vector3(0, axisLength + axisLength * 0.03, 0), 0x00ff00);
      crearEtiqueta(this.ejeZ || 'Z', new THREE.Vector3(0, 0, axisLength + axisLength * 0.03), 0x0000ff);
    });
  }

  crear3DScatterPlot(): void {
    if (!this.scene || !this.resultado.length) return;

    // Limpiar puntos previos y ejes
    const objetosARemover = this.scene.children.filter((child: THREE.Object3D) =>
      child.userData['tipo'] === 'punto' || child.userData['tipo'] === 'eje' || child.userData['tipo'] === 'label' || child.userData['tipo'] === 'centroide' || child.userData['tipo'] === 'centroideLabel'
    );
    objetosARemover.forEach(objeto => this.scene.remove(objeto));

    this.crearEjes();

    const grupos: { [key: string]: any[] } = {};
    this.resultado.forEach(row => {
      const grupo = row['grupo'];
      const x = parseFloat(row[this.ejeX]) || 0;
      const y = parseFloat(row[this.ejeY]) || 0;
      const z = parseFloat(row[this.ejeZ]) || 0;

      if (!grupo) return;

      if (!grupos[grupo]) grupos[grupo] = [];
      grupos[grupo].push({ x, y, z });
    });

    // Dibujar puntos de clusters
    Object.entries(grupos).forEach(([grupo, puntos], index) => {
      const color = new THREE.Color(this.modernColors[index % this.modernColors.length]);

      puntos.forEach(punto => {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshPhongMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(punto.x, punto.y, punto.z);
        mesh.userData['tipo'] = 'punto';
        mesh.userData['cluster'] = grupo;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
      });
    });

    // Dibujar centroides con etiqueta
    this.centroides.forEach((c, index) => {
      const color = new THREE.Color(0x000000); // Negro para centroides
      const geometry = new THREE.SphereGeometry(0.4, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: 0xffff00,
        emissiveIntensity: 0.7,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(c.valores[this.ejeX], c.valores[this.ejeY], c.valores[this.ejeZ]);
      mesh.userData['tipo'] = 'centroide';
      this.scene.add(mesh);

      // Etiqueta para centroides
      const loader = new FontLoader();
      loader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
        const textGeom = new TextGeometry(`C${c.cluster}`, {
          font,
          size: 0.5,
          depth: 0.05,
          curveSegments: 12,
        });
        const textMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const label = new THREE.Mesh(textGeom, textMat);
        label.position.set(c.valores[this.ejeX] + 0.5, c.valores[this.ejeY], c.valores[this.ejeZ]);
        label.userData['tipo'] = 'centroideLabel';
        this.scene.add(label);
      });
    });
  }

  animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    this.controls.update();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  // Métodos de exportación existentes (sin cambios)
  async exportar(): Promise<void> {
    if (this.tipoExportacion === 'estadisticas' && this.formatoExportacion === 'pdf') {
      await this.exportarEstadisticasPDFConGraficas();
    } else if (this.tipoExportacion === 'centroides') {
      this.formatoExportacion === 'pdf' ? this.exportarPDF() : this.exportarCentroidesCSV();
    } else if (this.tipoExportacion === 'estadisticas') {
      this.exportarEstadisticasCSV();
    } else if (this.tipoExportacion === 'datos') {
      this.formatoExportacion === 'pdf' ? this.exportarDatosAgrupadosPDF() : this.exportarExcel();
    }
  }

  exportarPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.text('Centroides por Cluster', 148, 15, { align: 'center' });

    const columnasPDF = ['Cluster', ...this.variablesSeleccionadas];
    const filasPDF = this.centroides.map(c =>
      [c.cluster, ...this.variablesSeleccionadas.map(v => c.valores[v]?.toFixed(2) ?? '')]
    );

    autoTable(doc, {
      startY: 25,
      head: [columnasPDF],
      body: filasPDF,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [102, 126, 234], // Azul vibrante
        textColor: 255,
        fontStyle: 'bold'
      },
      bodyStyles: {
        textColor: 40
      },
      alternateRowStyles: {
        fillColor: [245, 245, 250]
      },
      margin: { left: 10, right: 10 }
    });

    doc.save('centroides.pdf');
  }

  exportarCentroidesCSV(): void {
    const filas = this.centroides.map(c => {
      const fila: any = { cluster: c.cluster };
      this.variablesSeleccionadas.forEach(v => fila[v] = c.valores[v]);
      return fila;
    });

    const columnas = ['cluster', ...this.variablesSeleccionadas];
    const csv = [
      columnas.join(','),
      ...filas.map(row => columnas.map(col => JSON.stringify(row[col] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'centroides.csv');
  }

  exportarEstadisticasCSV(): void {
    const filas: any[] = [];

    for (const cluster in this.estadisticas) {
      const fila: any = { cluster };
      for (const variable of this.variablesSeleccionadas) {
        fila[variable] = this.estadisticas[cluster].media[variable];
      }
      filas.push(fila);
    }

    const columnas = ['cluster', ...this.variablesSeleccionadas];
    const csv = [
      columnas.join(','),
      ...filas.map(row => columnas.map(col => JSON.stringify(row[col] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'estadisticas.csv');
  }

  async exportarEstadisticasPDFConGraficas(): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('times'); // Fuente con mejor soporte de caracteres latinos

    const columnasPDF = ['Cluster', ...this.variablesSeleccionadas];
    const filasPDF = Object.entries(this.estadisticas).map(([cluster, stats]) =>
      [cluster, ...this.variablesSeleccionadas.map(v => stats.media[v]?.toFixed(2) ?? '')]
    );

    // Primera página: Título y tabla
    doc.setFontSize(16);
    doc.text('Análisis Estadístico por Cluster', 148, 15, { align: 'center' });

    autoTable(doc, {
      startY: 25,
      head: [columnasPDF],
      body: filasPDF,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [63, 81, 181], // Azul profesional
        textColor: 255,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fillColor: [245, 245, 245],
        textColor: 33
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      margin: { top: 25, left: 10, right: 10 }
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const charts = [
      { title: 'Gráfico de Barras', canvas: this.barChartCanvas },
      { title: 'Gráfico de Radar', canvas: this.radarChartCanvas },
      { title: 'Gráfico de Pastel', canvas: this.pieChartCanvas },
      { title: 'Gráfico de Dispersión', canvas: this.scatterChartCanvas }
    ];

    for (const chart of charts) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text(chart.title, 148, 15, { align: 'center' });

      const image = chart.canvas.nativeElement.toDataURL('image/png');
      doc.addImage(image, 'PNG', 10, 25, 270, 140);
    }

    doc.save('analisis_completo.pdf');
  }




  exportarDatosAgrupadosPDF(): void {
    const doc = new jsPDF();
    doc.text('Datos Agrupados con Cluster', 10, 10);

    const filasPDF = this.resultado.map(row =>
      this.columnas.map(col => row[col])
    );

    autoTable(doc, {
      startY: 20,
      head: [this.columnas],
      body: filasPDF
    });

    doc.save('datos_agrupados.pdf');
  }

  exportarExcel(): void {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.resultado);
    const workbook: XLSX.WorkBook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'datos_agrupados.xlsx');
  }



  // Calcula las páginas
  get totalPaginas(): number {
    return Math.ceil(this.resultado.length / this.filasPorPagina);
  }

  // Retorna solo las filas de la página actual
  filasPaginadas(): any[] {
    const inicio = (this.paginaActual - 1) * this.filasPorPagina;
    const fin = inicio + this.filasPorPagina;
    return this.resultado.slice(inicio, fin);
  }
} 