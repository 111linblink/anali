from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from collections import defaultdict
from sklearn.cluster import KMeans
from io import StringIO
import pandas as pd
import joblib
import io
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar modelo, scaler y temas
modelo = joblib.load("modelo.pkl")
scaler = joblib.load("scaler.pkl")
temas = joblib.load("temas.pkl")

def limpiar_texto(texto):
    """Elimina los números de identificación de las preguntas"""
    # Eliminar patrones como -5, -5.1, -5.2, etc.
    texto_limpio = re.sub(r'\s*-\s*\d+\.?\d*\s*', '', str(texto))
    return texto_limpio.strip()

@app.post("/temas_preguntas/")
async def obtener_preguntas(file: UploadFile = File(...)):
    try:
        # Leer archivo
        contents = await file.read()
        buffer = io.BytesIO(contents)

        # Leer encabezado 1 (temas)
        df_temas = pd.read_csv(buffer, nrows=1, header=None, encoding="latin1")

        # Reset el buffer para volver a leer desde el inicio
        buffer.seek(0)

        # Leer encabezado 2 (preguntas) y datos
        df = pd.read_csv(buffer, header=1, encoding="latin1")

        # Combinar: Tema - Pregunta (limpiando números)
        temas = df_temas.iloc[0].tolist()
        preguntas = df.columns.tolist()

        columnas_completas = []
        for tema, pregunta in zip(temas, preguntas):
            tema = limpiar_texto(tema)
            pregunta = limpiar_texto(pregunta)
            
            if not tema or tema.lower().startswith("unnamed"):
                columnas_completas.append(pregunta)
            else:
                columnas_completas.append(f"{tema} - {pregunta}")

        df.columns = columnas_completas

        # Agrupar preguntas por tema
        temas_dict = defaultdict(list)
        for col in df.columns:
            if ' - ' in col:
                tema, pregunta = col.split(' - ', 1)
                tema = tema.strip()
                pregunta = pregunta.strip()

                # Excluir campos administrativos
                if any(x in pregunta.lower() for x in ['nombre', 'edad', 'genero']):
                    continue

                if pregunta not in temas_dict[tema]:
                    temas_dict[tema].append(pregunta)

        return {"temas": temas_dict}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/predecir/")
async def predecir(file: UploadFile = File(...), variables: str = Form(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents), encoding="latin1")
        
        # Limpiar nombres de columnas
        df.columns = [limpiar_texto(col) for col in df.columns]
        
        seleccionadas = [limpiar_texto(v.strip()) for v in variables.split(",") if v.strip()]

        if not seleccionadas:
            return JSONResponse(status_code=400, content={"error": "No se seleccionaron variables"})

        # Convertir a numérico
        for col in seleccionadas:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # Calcular promedio por tema
        entrada = {}
        for tema in temas:
            preguntas_tema = [col for col in seleccionadas if tema.lower() in col.lower()]
            if preguntas_tema:
                entrada[tema] = df[preguntas_tema].mean(axis=1).mean()
            else:
                entrada[tema] = 0  # Tema no seleccionado

        entrada_df = pd.DataFrame([entrada])

        # Escalar y predecir
        entrada_escalada = scaler.transform(entrada_df)
        cluster = modelo.predict(entrada_escalada)[0]

        return {
            "cluster_estimado": int(cluster),
            "entrada_escalada": entrada_escalada.tolist(),
            "entrada_cruda": entrada
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    

@app.post("/preanalisis/")
async def preanalisis(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_csv(StringIO(contents.decode("utf-8")))
    
    # Limpiar nombres de columnas
    df.columns = [limpiar_texto(col) for col in df.columns]

    # Calculamos promedio por columna
    promedios = df.mean().round(2).to_dict()

    # Simulamos un cluster con base en promedio general
    promedio_general = sum(promedios.values()) / len(promedios)
    if promedio_general >= 4:
        cluster = 0
    elif promedio_general >= 3:
        cluster = 1
    else:
        cluster = 2

    return {
        "cluster": cluster,
        "valores": promedios
    }


@app.post("/analizar/")
async def analizar(
    file: UploadFile = File(...),
    variables: str = Form(...),
    k: int = Form(...)
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        columnas = [v.strip() for v in variables.split(",") if v.strip() != ""]
        columnas_numericas = [col for col in columnas if pd.api.types.is_numeric_dtype(df[col])]

        if len(columnas_numericas) == 0:
            return JSONResponse(status_code=400, content={"error": "No hay columnas numéricas para analizar"})

        datos = df[columnas_numericas].dropna()

        if datos.shape[0] < k:
            return JSONResponse(
                status_code=400,
                content={"error": f"No hay suficientes filas para {k} clusters. Datos disponibles: {datos.shape[0]}"}
            )

        modelo = KMeans(n_clusters=k, random_state=42)
        clusters = modelo.fit_predict(datos)
        df['grupo'] = clusters

        # Centroides (promedios por cluster)
        centroides = modelo.cluster_centers_
        centroides_dict = []
        for i, centroide in enumerate(centroides):
            centroides_dict.append({
                'cluster': i,
                'valores': dict(zip(columnas_numericas, centroide))
            })

        # Conteo por cluster
        conteo_clusters = df['grupo'].value_counts().to_dict()

        # Estadísticas descriptivas por cluster
        stats_por_cluster = {}
        for c in range(k):
            subset = df[df['grupo'] == c][columnas_numericas]
            stats_por_cluster[c] = {
                'media': subset.mean().to_dict(),
                'std': subset.std().to_dict(),
                'count': subset.shape[0]
            }

        resultado = df.to_dict(orient="records")

        return JSONResponse(content={
            "resultado": resultado,
            "columnas": df.columns.tolist(),
            "centroides": centroides_dict,
            "conteo_clusters": conteo_clusters,
            "estadisticas": stats_por_cluster
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Error interno: {str(e)}"})

