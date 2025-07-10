import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { NgChartsModule } from 'ng2-charts';

// Interfaz para tipar la estructura de estadísticas
interface EstadisticaMedia {
  media: { [key: string]: number };
}

interface Estadistica {
  [cluster: string]: EstadisticaMedia;
}

@Component({
  selector: 'app-analizar',
  standalone: true,
  imports: [CommonModule, RouterModule, NgChartsModule],
  templateUrl: './analizar.html',
  styleUrls: ['./analizar.css']
})
export class AnalizarComponent implements OnInit {
  resultado: any[] = [];
  columnas: string[] = [];
  variablesSeleccionadas: string[] = [];
  centroides: any[] = [];
  conteoClusters: { [key: number]: number } = {};
  estadisticas: Estadistica = {}; // Tipado seguro

  barChartData: any = {};
  radarChartData: any = {};

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
    const filas = datos.map(row => columnas.map(col => row[col]).join(','));
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
          backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
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
  }
}