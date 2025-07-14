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
    '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#8b5a8c', '#F28E2B',  // naranja suave
  '#D9E77D', '#59A14F'   // verde más fuerte
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

    // Agrupar puntos por cluster
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

    // Ordenar los grupos para consistencia en los colores
    const gruposOrdenados = Object.keys(grupos).sort();
this.scatterChartData = {
  datasets: Object.entries(this.conteoClusters).map(([cluster, count], i) => {
    const datosDelGrupo = this.resultado.filter(item => item.grupo === Number(cluster));
    return {
      label: `Cluster ${cluster}`,
      data: datosDelGrupo.map(item => ({ x: item[this.ejeX], y: item[this.ejeY] })),
      backgroundColor: this.modernColors[i % this.modernColors.length] + 'AA',
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 0
    };
  })
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
            usePointStyle: true,
            padding: 20,
            boxWidth: 12
          },
          onClick: (e, legendItem, legend) => {
            // Deshabilitar la funcionalidad de ocultar al hacer clic en la leyenda
            return;
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`
          }
        }
        ,
        datalabels: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: this.ejeX,
            font: { size: 14, weight: 'bold' },
            color: '#374151',
            padding: { top: 10 }
          },
          grid: {
            color: '#f3f4f6',
            drawBorder: true
          },
          ticks: {
            color: '#6b7280',
            font: { size: 12 }
          }
        },
        y: {
          title: {
            display: true,
            text: this.ejeY,
            font: { size: 14, weight: 'bold' },
            color: '#45669cff',
            padding: { bottom: 10 }
          },
          grid: {
            color: '#f3f4f6',
            drawBorder: true
          },
          ticks: {
            color: '#6b7280',
            font: { size: 12 }
          }
        }
      },
      elements: {
        point: {
          hoverBackgroundColor: (context) => {
            const dataset = context.dataset;
            return dataset.backgroundColor as string; // Asegurar el tipo de retorno
          }
        }
      }
    };
  }

  // Inicializar Three.js
  initThreeJS(): void {
    if (!this.threejsContainer) return;

    const container = this.threejsContainer.nativeElement;
    const width = container.clientWidth;
    const height = 500; // Altura fija para mejor visualización

    // Limpiar renderizador anterior si existe
    if (this.renderer) {
      this.renderer.dispose();
      container.innerHTML = '';
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8fafc);

    // Configurar cámara con mejor posición inicial
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Mejor iluminación
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Luz de relleno
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-10, 10, 5);
    this.scene.add(fillLight);

    // Controles más suaves
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI * 0.9; // Evitar voltear completamente
    this.controls.screenSpacePanning = false;

    // Manejar redimensionamiento
    window.addEventListener('resize', () => this.onWindowResize());

    this.animate();
  }

  private onWindowResize(): void {
    const container = this.threejsContainer?.nativeElement;
    if (!container || !this.camera || !this.renderer) return;

    const width = container.clientWidth;
    const height = 500; // Mantener altura fija

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  crearEjes(): void {
    const container = this.threejsContainer?.nativeElement;
    if (!container) return;

    // Limpiar ejes anteriores
    const toRemove = this.scene.children.filter(
      (child) => child.userData['tipo'] === 'eje' || child.userData['tipo'] === 'label'
    );
    toRemove.forEach(child => this.scene.remove(child));

    // Calcular longitud de ejes basada en los datos
    const valoresX = this.resultado.map(r => parseFloat(r[this.ejeX]) || 0);
    const valoresY = this.resultado.map(r => parseFloat(r[this.ejeY]) || 0);
    const valoresZ = this.resultado.map(r => parseFloat(r[this.ejeZ]) || 0);

    const maxX = Math.max(...valoresX.map(Math.abs), 10);
    const maxY = Math.max(...valoresY.map(Math.abs), 10);
    const maxZ = Math.max(...valoresZ.map(Math.abs), 10);

    const axisLength = Math.max(maxX, maxY, maxZ) * 1.5;

    // Grosor de los ejes
    const axisWidth = 0.05;

    // Materiales para los ejes
    const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });

    // Crear ejes como cilindros para mejor visibilidad
    const createAxis = (length: number, material: THREE.Material, rotation: [number, number, number]) => {
      const geometry = new THREE.CylinderGeometry(axisWidth, axisWidth, length, 8);
      geometry.rotateX(rotation[0]);
      geometry.rotateY(rotation[1]);
      geometry.rotateZ(rotation[2]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        rotation[1] === Math.PI / 2 ? length / 2 : 0,
        rotation[0] === Math.PI / 2 ? length / 2 : 0,
        rotation[2] === Math.PI / 2 ? length / 2 : 0
      );
      mesh.userData['tipo'] = 'eje';
      return mesh;
    };

    // Eje X (rojo)
    this.scene.add(createAxis(axisLength, xMaterial, [0, Math.PI / 2, 0]));

    // Eje Y (verde)
    this.scene.add(createAxis(axisLength, yMaterial, [Math.PI / 2, 0, 0]));

    // Eje Z (azul)
    this.scene.add(createAxis(axisLength, zMaterial, [0, 0, Math.PI / 2]));

    // Conos para las puntas de los ejes
    const coneGeometry = new THREE.ConeGeometry(axisWidth * 2, axisWidth * 4, 16);

    // Cono X
    const coneX = new THREE.Mesh(coneGeometry, xMaterial);
    coneX.position.set(axisLength + axisWidth * 2, 0, 0);
    coneX.rotation.set(0, -Math.PI / 2, 0);
    coneX.userData['tipo'] = 'eje';
    this.scene.add(coneX);

    // Cono Y
    const coneY = new THREE.Mesh(coneGeometry, yMaterial);
    coneY.position.set(0, axisLength + axisWidth * 2, 0);
    coneY.userData['tipo'] = 'eje';
    this.scene.add(coneY);

    // Cono Z
    const coneZ = new THREE.Mesh(coneGeometry, zMaterial);
    coneZ.position.set(0, 0, axisLength + axisWidth * 2);
    coneZ.rotation.set(Math.PI / 2, 0, 0);
    coneZ.userData['tipo'] = 'eje';
    this.scene.add(coneZ);

    // Etiquetas de ejes con mejor formato
    const loader = new FontLoader();
    loader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
      const crearEtiqueta = (texto: string, posicion: THREE.Vector3, color: number) => {
        const geom = new TextGeometry(texto, {
          font,
          size: axisLength * 0.05,
          depth: 0.05,
          curveSegments: 12,
        });
        const mat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(posicion);
        mesh.userData['tipo'] = 'label';
        this.scene.add(mesh);
      };

      const labelOffset = axisLength * 0.1;
      crearEtiqueta(this.ejeX || 'X', new THREE.Vector3(axisLength + labelOffset, 0, 0), 0xff0000);
      crearEtiqueta(this.ejeY || 'Y', new THREE.Vector3(0, axisLength + labelOffset, 0), 0x00ff00);
      crearEtiqueta(this.ejeZ || 'Z', new THREE.Vector3(0, 0, axisLength + labelOffset), 0x0000ff);
    });
  }

  crear3DScatterPlot(): void {
    if (!this.scene || !this.resultado.length) return;

    // Limpiar elementos anteriores
    const objetosARemover = this.scene.children.filter((child: THREE.Object3D) =>
      child.userData['tipo'] === 'punto' || child.userData['tipo'] === 'eje' ||
      child.userData['tipo'] === 'label' || child.userData['tipo'] === 'centroide' ||
      child.userData['tipo'] === 'centroideLabel'
    );
    objetosARemover.forEach(objeto => this.scene.remove(objeto));

    this.crearEjes();

    // Agrupar puntos por cluster
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

    // Ordenar grupos para consistencia en colores
    const gruposOrdenados = Object.keys(grupos).sort();

    // Crear geometrías compartidas para optimización
    const sphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereGeometryCentroide = new THREE.SphereGeometry(0.4, 16, 16);

    // Dibujar puntos de clusters
    gruposOrdenados.forEach((grupo, index) => {
      const color = new THREE.Color(this.modernColors[index % this.modernColors.length]);
      const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        shininess: 30,
        specular: new THREE.Color(0xffffff)
      });

      grupos[grupo].forEach(punto => {
        const mesh = new THREE.Mesh(sphereGeometry, material.clone());
        mesh.position.set(punto.x, punto.y, punto.z);
        mesh.userData = {
          tipo: 'punto',
          cluster: grupo,
          originalColor: color.getHex()
        };
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Interactividad
        // Interactividad
        mesh.userData['onHover'] = () => {
          mesh.material.color.setHex(0xffffff);
          mesh.scale.set(1.5, 1.5, 1.5);
        };

        mesh.userData['onHoverOut'] = () => {
          mesh.material.color.setHex(mesh.userData['originalColor']);
          mesh.scale.set(1, 1, 1);
        };

        this.scene.add(mesh);
      });
    });

    // Dibujar centroides con etiqueta
    this.centroides.forEach((c, index) => {
      const color = new THREE.Color(0x000000); // Negro para centroides
      const material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: 0xffff00,
        emissiveIntensity: 0.7,
        shininess: 100
      });

      const mesh = new THREE.Mesh(sphereGeometryCentroide, material);
      mesh.position.set(c.valores[this.ejeX], c.valores[this.ejeY], c.valores[this.ejeZ]);
      mesh.userData = {
        tipo: 'centroide',
        cluster: c.cluster
      };
      mesh.castShadow = true;
      this.scene.add(mesh);

      // Etiqueta para centroides
      const loader = new FontLoader();
      loader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
        const textGeom = new TextGeometry(`Centroide ${c.cluster}`, {
          font,
          size: 0.5,
          depth: 0.05,
          curveSegments: 12,
        });
        const textMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.9
        });
        const label = new THREE.Mesh(textGeom, textMat);
        label.position.set(
          c.valores[this.ejeX] + 0.5,
          c.valores[this.ejeY],
          c.valores[this.ejeZ]
        );
        label.userData = {
          tipo: 'centroideLabel',
          cluster: c.cluster
        };
        this.scene.add(label);
      });
    });

    // Agregar interactividad
    this.setup3DInteractivity();
  }

  private setup3DInteractivity(): void {
    const container = this.threejsContainer?.nativeElement;
    if (!container) return;

    // Variables para el hover
    let hoveredObject: THREE.Object3D | null = null;

    // Configurar raycaster para detectar hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    container.addEventListener('mousemove', (event) => {
      // Calcular posición normalizada del mouse
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Actualizar raycaster
      raycaster.setFromCamera(mouse, this.camera);

      // Buscar intersecciones
      const intersects = raycaster.intersectObjects(this.scene.children);

      // Manejar hover out
      if (hoveredObject && hoveredObject.userData['onHoverOut']) {
        hoveredObject.userData['onHoverOut']();
        hoveredObject = null;
      }

      // Manejar hover in
      if (intersects.length > 0) {
        const firstIntersected = intersects[0].object;
        if (firstIntersected.userData['onHover']) {
          firstIntersected.userData['onHover']();
          hoveredObject = firstIntersected;

          // Cambiar estilo del cursor
          container.style.cursor = 'pointer';
        } else {
          container.style.cursor = 'default';
        }
      } else {
        container.style.cursor = 'default';
      }
    });
  }

  private lastTime = 0;
  private frameCount = 0;
  private fps = 0;

  animate(): void {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;
    this.frameCount++;

    // Calcular FPS cada segundo
    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = now;

      // Ajustar calidad dinámicamente basado en FPS
      if (this.fps < 30 && this.renderer) {
        this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio - 0.5));
      } else if (this.fps > 50 && this.renderer) {
        this.renderer.setPixelRatio(window.devicePixelRatio);
      }
    }

    // Solo renderizar si hay cambios o controles en movimiento
    if (this.controls && (this.controls.enabled || this.controls.isRotating || this.controls.isPanning)) {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    } else if (this.scene && this.camera && this.renderer) {
      // Renderizado mínimo cuando no hay interacción
      requestAnimationFrame(() => this.animate());
      return;
    }

    this.animationId = requestAnimationFrame(() => this.animate());
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