from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
from sklearn.cluster import KMeans
import io
import traceback

app = FastAPI()

# Configurar CORS para permitir peticiones desde localhost:4200 (Angular frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Cambia si tu frontend está en otro dominio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        # Leer CSV desde bytes
        df = pd.read_csv(io.BytesIO(contents))

        # Retornar columnas y primeras filas para vista previa
        return {"columns": df.columns.tolist(), "preview": df.head().to_dict(orient="records")}
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=400, content={"error": f"Error leyendo archivo: {str(e)}"})

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

