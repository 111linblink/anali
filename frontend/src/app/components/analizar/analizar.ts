import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
import { Chart } from 'chart.js';

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
export class AnalizarComponent implements OnInit {
  resultado: any[] = [];
  columnas: string[] = [];
  variablesSeleccionadas: string[] = [];
  centroides: any[] = [];
  conteoClusters: { [key: number]: number } = {};
  estadisticas: Estadistica = {};

  barChartData: any = {};
  radarChartData: any = {};
  pieChartData: any = {};
  scatterChartData: any = {};
  scatterOptions: any = {};
  bubbleChartData: any = {};
  bubbleOptions: any = {};

  ejeX: string = '';
  ejeY: string = '';

  tipoExportacion: string = 'centroides';
  formatoExportacion: string = 'pdf';
  ChartDataLabels = ChartDataLabels;

  @ViewChild('barChartCanvas') barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarChartCanvas') radarChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChartCanvas') pieChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scatterChartCanvas') scatterChartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private http: HttpClient) {}

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

    if (this.variablesSeleccionadas.length >= 2) {
      [this.ejeX, this.ejeY] = this.variablesSeleccionadas.slice(0, 2);
    } else {
      this.ejeX = this.variablesSeleccionadas[0] || '';
      this.ejeY = this.variablesSeleccionadas[1] || '';
    }

    this.enviarDatosAlBackend(datos, variables, 3);
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
        this.prepararGraficas();
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

  prepararGraficas() {
    const clusters = Object.keys(this.conteoClusters);
    const cantidades = Object.values(this.conteoClusters);

    this.barChartData = {
      labels: clusters.map(c => 'Grupo ' + c),
      datasets: [
        {
          label: 'Número de individuos por cluster',
          data: cantidades,
          backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726', '#BA68C8', '#FF6384'],
        },
      ]
    };

    const radarLabels = this.variablesSeleccionadas;
    const radarDatasets = Object.entries(this.estadisticas).map(([cluster, stats]) => ({
      label: `Grupo ${cluster}`,
      data: radarLabels.map(label => stats.media[label]),
      fill: true
    }));
    this.radarChartData = {
      labels: radarLabels,
      datasets: radarDatasets
    };

    this.pieChartData = {
      labels: clusters.map(c => 'Grupo ' + c),
      datasets: [{
        data: cantidades,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#66BB6A', '#BA68C8']
      }]
    };

    this.actualizarGraficoDispersion();
  }

  actualizarGraficoDispersion(): void {
    const colores = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231'];
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
        label: `Grupo ${grupo}`,
        data: puntos,
        backgroundColor: colores[index % colores.length],
      }))
    };

    this.scatterOptions = {
      scales: {
        x: { title: { display: true, text: this.ejeX } },
        y: { title: { display: true, text: this.ejeY } }
      }
    };

    this.bubbleChartData = {
      datasets: Object.entries(grupos).map(([grupo, puntos], index) => ({
        label: `Grupo ${grupo}`,
        data: puntos.map(p => ({ x: p.x, y: p.y, r: 5 })),
        backgroundColor: colores[index % colores.length],
      }))
    };

    this.bubbleOptions = {
      scales: {
        x: { title: { display: true, text: this.ejeX } },
        y: { title: { display: true, text: this.ejeY } }
      },
      plugins: {
        datalabels: { display: false }
      }
    };
  }

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
    const doc = new jsPDF();
    doc.text('Centroides por Cluster', 10, 10);

    const columnasPDF = ['Cluster', ...this.variablesSeleccionadas];
    const filasPDF = this.centroides.map(c => [c.cluster, ...this.variablesSeleccionadas.map(v => c.valores[v])]);

    autoTable(doc, {
      startY: 20,
      head: [columnasPDF],
      body: filasPDF,
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
    const doc = new jsPDF();
    doc.text('Estadísticas por Cluster', 10, 10);

    const columnasPDF = ['Cluster', ...this.variablesSeleccionadas];
    const filasPDF = Object.entries(this.estadisticas).map(([cluster, stats]) =>
      [cluster, ...this.variablesSeleccionadas.map(v => stats.media[v])]
    );

    autoTable(doc, {
      startY: 20,
      head: [columnasPDF],
      body: filasPDF
    });

    // ⏳ Esperamos un poco para asegurar que los canvas estén renderizados
    await new Promise(resolve => setTimeout(resolve, 500));

    const barImage = this.barChartCanvas.nativeElement.toDataURL('image/png');
    const radarImage = this.radarChartCanvas.nativeElement.toDataURL('image/png');
    const pieImage = this.pieChartCanvas.nativeElement.toDataURL('image/png');
    const scatterImage = this.scatterChartCanvas.nativeElement.toDataURL('image/png');

    doc.addPage();
    doc.text('Gráfico de Barras', 10, 10);
    doc.addImage(barImage, 'PNG', 10, 20, 180, 90);

    doc.addPage();
    doc.text('Gráfico de Radar', 10, 10);
    doc.addImage(radarImage, 'PNG', 10, 20, 180, 90);

    doc.addPage();
    doc.text('Gráfico de Pastel', 10, 10);
    doc.addImage(pieImage, 'PNG', 10, 20, 180, 90);

    doc.addPage();
    doc.text('Gráfico de Dispersión', 10, 10);
    doc.addImage(scatterImage, 'PNG', 10, 20, 180, 90);

    doc.save('estadisticas_con_graficas.pdf');
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
}
