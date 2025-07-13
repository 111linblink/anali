# -*- coding: utf-8 -*-
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import joblib

# ==========================
# Cargar archivo con doble encabezado (temas y preguntas)
# ==========================

# Leer primer encabezado (temas)
df_temas = pd.read_csv("agrupacion_resultado.csv", nrows=1, header=None, encoding="latin1")

# Leer segundo encabezado (preguntas) + datos
df = pd.read_csv("agrupacion_resultado.csv", header=1, encoding="latin1")

# Combinar encabezados en formato "Tema - Pregunta"
temas = df_temas.iloc[0].tolist()
preguntas = df.columns.tolist()

nombres_columnas = []
for tema, pregunta in zip(temas, preguntas):
    tema = str(tema).strip()
    pregunta = str(pregunta).strip()
    if not tema or tema.lower().startswith("unnamed"):
        nombres_columnas.append(pregunta)
    else:
        nombres_columnas.append(f"{tema} - {pregunta}")

df.columns = nombres_columnas

# ==========================
# Eliminar columnas no numéricas
# ==========================
df = df.drop(columns=[
    col for col in df.columns
    if df[col].dtype == 'object' or any(x in col.lower() for x in ['nombre', 'género', 'genero', 'edad'])
], errors='ignore')

# ==========================
# Convertir a valores numéricos
# ==========================
df = df.apply(pd.to_numeric, errors='coerce')

# ==========================
# Agrupar columnas por temas
# ==========================
temas_definidos = ["Honestidad", "Empatia", "Tolerancia", "Justicia", "Autocontrol", "Responsabilidad"]
grupos = {tema: [] for tema in temas_definidos}

for col in df.columns:
    for tema in temas_definidos:
        if tema.lower() in col.lower():
            grupos[tema].append(col)

# Verificar que todos los grupos tengan columnas válidas
for tema, columnas in grupos.items():
    if not columnas:
        raise ValueError(f"No se encontraron columnas para el grupo '{tema}'")

# ==========================
# Calcular promedios por grupo
# ==========================
df_grupos = pd.DataFrame()
for tema, columnas in grupos.items():
    df_grupos[tema] = df[columnas].mean(axis=1)

# Rellenar NaN con la media de cada columna
df_grupos = df_grupos.fillna(df_grupos.mean())

# ==========================
# Escalar los datos
# ==========================
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df_grupos)

# ==========================
# Entrenar modelo KMeans
# ==========================
modelo = KMeans(n_clusters=3, random_state=42)
modelo.fit(X_scaled)

# ==========================
# Guardar modelo, escalador y nombres de los temas
# ==========================
joblib.dump(modelo, "modelo.pkl")
joblib.dump(scaler, "scaler.pkl")
joblib.dump(list(df_grupos.columns), "temas.pkl")

print("Modelo entrenado con éxito.")
