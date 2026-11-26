#!/usr/bin/env python3
"""
Generador de datos de prueba SINTÉTICOS para PJL Crédito.

Produce, a partir de una sola semilla, datos coherentes entre sí:
  - src/Database/oracle/05_datos_prueba.sql        (base Oracle: transacciones)
  - src/Services/core-api/src/main/resources/simulador/core-bancario.json   (core de la cooperativa)
  - src/Services/core-api/src/main/resources/simulador/externos.json        (buró, SB/SEPS, Registro Civil)
  - src/Services/core-api/src/main/resources/simulador/nube/*.json          (nube privada: información)

Las personas, cédulas, cuentas y montos son ficticios. El tarifario se toma de 02_catalogos.sql.
Uso:  python3 -I scripts/generar_datos_prueba.py
"""
import hashlib
import json
import math
import random
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SQL_CATALOGOS = RAIZ / "src/Database/oracle/02_catalogos.sql"
SALIDA_SQL = RAIZ / "src/Database/oracle/05_datos_prueba.sql"
SIM = RAIZ / "src/Services/core-api/src/main/resources/simulador"

R = random.Random(20261115)
CLAVE_DEMO = "Pjl.2026"

# ---------------------------------------------------------------- catálogos
NOMBRES_F = ["Rosa Elvira", "Carmen Lucía", "Ana Belén", "Gloria Esperanza", "Luz Marina", "Diana Carolina",
             "Mónica Alexandra", "Sandra Patricia", "Jenny Maribel", "Lorena Isabel", "Martha Cecilia",
             "Verónica del Cisne", "Rocío Elizabeth", "Nancy Beatriz", "Paola Andrea", "Silvia Noemí",
             "Blanca Azucena", "Johanna Katherine", "Teresa de Jesús", "Mercedes Rosario", "Cristina Alejandra",
             "Fanny Lucrecia", "Glenda Maritza", "Rosario del Pilar"]
NOMBRES_M = ["Luis Alberto", "Jorge Iván", "Segundo Manuel", "Patricio Javier", "José Vicente", "Carlos Eduardo",
             "Byron Fabricio", "Manuel Agustín", "Wilson Ramiro", "Ángel Polibio", "Franklin Geovanny",
             "Diego Armando", "Édgar Rolando", "Milton Rodrigo", "Hernán Gonzalo", "Klever Ricardo", "Marco Vinicio",
             "Fausto Leonardo", "Juan Pablo", "Galo Bolívar", "Washington Darío", "Darwin Patricio", "Rómulo Efraín"]
APELLIDOS = ["Jiménez", "Ochoa", "Cueva", "Torres", "Armijos", "Sarango", "Castillo", "Ordóñez", "Vega", "Quizhpe",
             "Riofrío", "Loaiza", "Valdivieso", "Eguiguren", "Bravo", "Paladines", "Guarnizo", "Chamba", "Ojeda",
             "Aguirre", "Montesinos", "Vivanco", "Granda", "Sánchez", "Zhunaula", "Correa", "Ludeña", "Ramón",
             "Soto", "Merino", "Abad", "Tinoco", "Cuenca", "Iñiguez", "Puglla", "Medina"]

UBICACIONES = [  # (provincia, cantón, parroquia, barrio, agencia, calles, lat, lng)
    ("Loja", "Loja", "El Sagrario", "Centro", "Loja Centro", ["Bolívar", "Sucre", "10 de Agosto", "Azuay"], -3.9960, -79.2040),
    ("Loja", "Loja", "San Sebastián", "La Tebaida", "Loja Centro", ["Av. Manuel Agustín Aguirre", "Lourdes", "Mercadillo"], -4.0080, -79.2010),
    ("Loja", "Loja", "Sucre", "Las Pitas", "Loja Norte", ["Av. Cuxibamba", "Guaranda", "Tena"], -3.9790, -79.2060),
    ("Loja", "Loja", "El Valle", "Motupe", "Loja Norte", ["Av. 8 de Diciembre", "Juan José Flores"], -3.9590, -79.2120),
    ("Loja", "Loja", "San Sebastián", "La Argelia", "Loja Centro", ["Av. Pío Jaramillo Alvarado", "Reinaldo Espinosa"], -4.0310, -79.2010),
    ("Loja", "Catamayo", "Catamayo", "San José", "Catamayo", ["Av. Isidro Ayora", "Catamayo"], -3.9860, -79.3560),
    ("Loja", "Calvas", "Cariamanga", "Central", "Cariamanga", ["Bolívar", "Loja", "Eloy Alfaro"], -4.3290, -79.5540),
    ("Zamora Chinchipe", "Zamora", "Zamora", "Central", "Zamora", ["Diego de Vaca", "Sevilla de Oro"], -4.0670, -78.9560),
]
AGENCIAS = [
    {"codigo": "LOJ-C", "nombre": "Loja Centro", "canton": "Loja", "direccion": "Calle Bolívar y 10 de Agosto (dato de prueba)", "horario": "Lunes a viernes 08:00–17:00 · sábados 09:00–13:00", "lat": -3.9965, "lng": -79.2039},
    {"codigo": "LOJ-N", "nombre": "Loja Norte", "canton": "Loja", "direccion": "Av. Cuxibamba y Guaranda (dato de prueba)", "horario": "Lunes a viernes 08:30–17:00", "lat": -3.9781, "lng": -79.2052},
    {"codigo": "CAT", "nombre": "Catamayo", "canton": "Catamayo", "direccion": "Av. Isidro Ayora (dato de prueba)", "horario": "Lunes a viernes 08:30–16:30", "lat": -3.9858, "lng": -79.3567},
    {"codigo": "CAR", "nombre": "Cariamanga", "canton": "Calvas", "direccion": "Calle Bolívar (dato de prueba)", "horario": "Lunes a viernes 08:30–16:30", "lat": -4.3288, "lng": -79.5545},
    {"codigo": "ZAM", "nombre": "Zamora", "canton": "Zamora", "direccion": "Calle Diego de Vaca (dato de prueba)", "horario": "Lunes a viernes 08:30–16:30", "lat": -4.0672, "lng": -78.9563},
]

# Arquetipos de actividad económica del socio
ARQUETIPOS = [
    # condición, empresa/negocio, actividad, sector, ingreso mensual (min,max), productos, destino
    ("COMERCIANTE", "Tienda de abarrotes", "Venta de víveres al por menor", "COMERCIO", (1100, 2600), "Arroz, azúcar, aceite", "Compra de mercadería para la tienda"),
    ("COMERCIANTE", "Puesto en el mercado", "Venta de legumbres y frutas", "COMERCIO", (700, 1500), "Legumbres, frutas, granos", "Capital de trabajo para el puesto"),
    ("NEGOCIO_PROPIO", "Taller mecánico", "Mantenimiento automotriz", "SERVICIO", (1200, 2900), "Reparación, cambio de aceite, frenos", "Compra de herramientas y elevador"),
    ("NEGOCIO_PROPIO", "Panadería", "Elaboración y venta de pan", "PRODUCCION", (1300, 3200), "Pan, pasteles, bizcochuelos", "Horno industrial nuevo"),
    ("NEGOCIO_PROPIO", "Finca cafetalera", "Cultivo y venta de café", "AGRICULTURA", (650, 1900), "Café en grano, café tostado", "Insumos para la cosecha"),
    ("NEGOCIO_PROPIO", "Taller de costura", "Confección de prendas", "PRODUCCION", (650, 1400), "Uniformes escolares, ropa a medida", "Máquinas de coser industriales"),
    ("NEGOCIO_PROPIO", "Ganadería", "Crianza de ganado y venta de leche", "AGRICULTURA", (900, 2300), "Leche, quesillo, ganado en pie", "Compra de ganado lechero"),
    ("COMERCIANTE", "Ferretería", "Venta de materiales de construcción", "COMERCIO", (1600, 4200), "Cemento, varilla, pintura", "Ampliación del inventario"),
    ("NEGOCIO_PROPIO", "Restaurante", "Comida típica", "SERVICIO", (1100, 2900), "Almuerzos, cecina, tamales", "Remodelación del local"),
    ("COMERCIANTE", "Bazar y papelería", "Venta de útiles escolares", "COMERCIO", (800, 1900), "Útiles, copias, regalos", "Mercadería para temporada escolar"),
    ("EMPLEADO_PUBLICO", "Unidad educativa fiscal", "Docencia", "SERVICIO", (1050, 1650), None, "Arreglos en la vivienda"),
    ("EMPLEADO_PUBLICO", "Hospital general", "Enfermería", "SERVICIO", (1150, 1750), None, "Compra de electrodomésticos"),
    ("EMPLEADO_PRIVADO", "Distribuidora de consumo masivo", "Ventas", "COMERCIO", (650, 1150), None, "Gastos de estudios"),
    ("NEGOCIO_PROPIO", "Taxi de cooperativa", "Transporte de pasajeros", "SERVICIO", (950, 1850), "Carreras urbanas", "Repuestos y llantas del vehículo"),
    ("JUBILADO", "IESS", "Jubilación", "OTROS", (520, 950), None, "Gastos de salud"),
    ("HONORARIOS", "Estudio contable", "Servicios contables", "SERVICIO", (950, 2100), "Declaraciones, contabilidad", "Equipos de cómputo"),
]
PROFESIONES = {"EMPLEADO_PUBLICO": "Licenciatura", "HONORARIOS": "Contador público", "JUBILADO": "Bachiller"}

ETAPA_DE = {"1.1": 1, "1.2": 1, "1.3": 1, "2.1": 2, "2.2": 2, "2.3": 2, "3.1": 3, "3.2": 3, "3.3": 3, "3.4": 3,
            "4.1": 4, "4.2": 4, "4.3": 4, "5.1": 5, "5.2": 5, "6.1": 6, "6.2": 6, "6.3": 6}
ORDEN = list(ETAPA_DE.keys())

STAFF = [  # id, usuario, nombre, rol, agencia
    (1, "admin", "Administración del sistema", "ADMIN", "Matriz"),
    (2, "dmaldonado", "Diana Maldonado", "ASESOR", "Loja Centro"),
    (3, "jtandazo", "Jorge Tandazo", "ASESOR", "Catamayo"),
    (4, "pespinosa", "Paola Espinosa", "ANALISTA", "Matriz"),
    (5, "mvaldivieso", "Marco Valdivieso", "RIESGO", "Matriz"),
    (6, "ccarrion", "Cecilia Carrión", "COMITE", "Matriz"),
    (7, "lburneo", "Luis Burneo", "OPERACIONES", "Matriz"),
    (8, "rceli", "Rocío Celi", "CARTERA", "Matriz"),
    (9, "ajaramillo", "Andrés Jaramillo", "COBRANZA", "Matriz"),
]


# ---------------------------------------------------------------- utilidades
def q(v):
    """Literal SQL."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "'S'" if v else "'N'"
    if isinstance(v, (int,)):
        return str(v)
    if isinstance(v, float):
        return f"{v:.6f}".rstrip("0").rstrip(".") if not v.is_integer() else str(int(v))
    return "'" + str(v).replace("'", "''") + "'"


def hace(dias):
    """Timestamp relativo a hoy (días hacia atrás, admite fracciones)."""
    return f"LOCALTIMESTAMP - NUMTODSINTERVAL({dias:.4f}, 'DAY')"


def fecha(dias):
    return f"TRUNC(SYSDATE) - {int(dias)}"


def insert(tabla, fila):
    cols = ", ".join(fila.keys())
    vals = ", ".join(v if isinstance(v, Raw) else q(v) for v in fila.values())
    return f"INSERT INTO {tabla} ({cols}) VALUES ({vals});"


class Raw(str):
    """Expresión SQL sin comillas."""


def cuota_francesa(monto, tasa, plazo):
    i = tasa / 100 / 12
    return round(monto * i / (1 - (1 + i) ** -plazo), 2)


def valor_presente(cuota, tasa, plazo):
    i = tasa / 100 / 12
    return cuota * (1 - (1 + i) ** -plazo) / i


usadas = set()


def cedula(prov):
    while True:
        d = [prov // 10, prov % 10, R.randint(0, 5)] + [R.randint(0, 9) for _ in range(6)]
        s = 0
        for i, x in enumerate(d):
            y = x * 2 if i % 2 == 0 else x
            s += y - 9 if y > 9 else y
        c = "".join(map(str, d)) + str((10 - s % 10) % 10)
        if c not in usadas:
            usadas.add(c)
            return c


def clave_hash(clave):
    sal = R.randbytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", clave.encode(), sal, 310000, 32)
    return "{pbkdf2@SpringSecurity_v5_8}" + (sal + dk).hex()


def sin_tildes(s):
    t = str.maketrans("áéíóúñÁÉÍÓÚÑü", "aeiounAEIOUNu")
    return s.translate(t)


def leer_productos():
    productos = {}
    for m in re.finditer(r"VALUES \((.*)\);", SQL_CATALOGOS.read_text(encoding="utf-8")):
        partes, buf, dentro = [], "", False
        for ch in m.group(1):
            if ch == "'":
                dentro = not dentro
                buf += ch
            elif ch == "," and not dentro:
                partes.append(buf.strip())
                buf = ""
            else:
                buf += ch
        partes.append(buf.strip())
        if len(partes) != 17:
            continue  # etapas / subetapas

        def val(x):
            if x == "NULL":
                return None
            if x.startswith("'"):
                return x[1:-1].replace("''", "'")
            return float(x)

        p = [val(x) for x in partes]
        productos[int(p[0])] = {
            "id": int(p[0]), "codigo": p[1], "segmento": p[2], "subsegmento": p[3], "nombre": p[4],
            "rangoVentas": p[5], "montoMinimo": p[6], "montoMaximo": p[7], "plazoMaximoMeses": int(p[8]),
            "tasaSinAhorro": p[9], "tasaConAhorro": p[10], "porcentajeAhorro": p[11], "tasaAhorro": p[12],
            "porcentajeAportacion": p[13], "tasaConAportacion": p[14], "requiereAhorro": p[15] == "S",
            "descripcion": p[16], "tasaReferencial": p[9] if p[9] is not None else p[10],
        }
    return productos


# ---------------------------------------------------------------- motor (espejo de MotorScoring.groovy)
CORTES = [("A", 720), ("B", 650), ("C", 580), ("D", 500), ("E", 0)]
AJUSTE_TASA = {"A": -0.50, "B": 0.0, "C": 0.75, "D": 1.50, "E": 0.0}
UMBRAL_AUTOMATICO = 20000


def evaluar(c):
    cuota = cuota_francesa(c["monto"], c["tasa"], c["plazo"])
    rci = (cuota + c["cuota_sfn"]) / c["ingresos"]
    endeud = c["pasivos"] / c["activos"] if c["activos"] > 0 else 1.0
    flujo = c["ingresos"] - c["egresos"] - cuota
    filtros = {
        "edad": 18 <= c["edad"] and c["edad"] + c["plazo"] / 12 <= 75,
        "capacidad": flujo > 0,
        "mora": c["deuda_vencida"] == 0,
        "sobreendeudamiento": rci <= 0.50,
        "listas": c["listas_ok"],
    }
    contrib = [
        ("Relación cuota / ingreso", f"{rci * 100:.1f} %", 3.2 * rci - 0.96),
        ("Nivel de endeudamiento", f"{endeud * 100:.1f} %", 1.1 * min(endeud, 1.5) - 0.33),
        ("Score de buró", str(c["score_buro"]), -0.0055 * (c["score_buro"] - 650)),
        ("Mora histórica en la cooperativa", f"{c['mora_hist']} días", 0.03 * min(c["mora_hist"], 60)),
        ("Antigüedad como socio", f"{c['antiguedad']} meses", -0.008 * min(c["antiguedad"], 120) + 0.24),
        ("Estabilidad de la actividad", f"{c['tiempo_trabajo']} meses", -0.006 * min(c["tiempo_trabajo"], 120) + 0.22),
        ("Ahorro en la cooperativa", f"${c['ahorro']:,.2f}", -0.45 if c["ahorro"] >= 0.10 * c["monto"] else 0.0),
        ("Peor calificación en el sistema", c["peor_calif"] or "Sin registro", 0.9 if c["peor_calif"] in ("C", "D", "E") else 0.0),
    ]
    z = -2.10 + 0.96 + 0.33 - 0.24 - 0.22 + sum(x[2] for x in contrib)
    pd = 1 / (1 + math.exp(-z))
    pd = min(max(pd, 0.0005), 0.9995)
    score = max(0, min(1000, round(500 + 72.13475 * math.log((1 - pd) / pd))))
    cat, corte = next((k, v) for k, v in CORTES if score >= v)
    supera = all(filtros.values())
    if not supera:
        dictamen, motivo, instancia = "RECHAZADO", "No supera los filtros de política: " + ", ".join(k for k, v in filtros.items() if not v) + ".", "MATRIZ_AUTOMATICA"
    elif cat == "E":
        dictamen, motivo, instancia = "RECHAZADO", f"Score {score} bajo el punto de corte mínimo (500).", "MATRIZ_AUTOMATICA"
    elif cat in ("A", "B") and c["monto"] <= UMBRAL_AUTOMATICO and rci <= 0.40:
        dictamen, motivo, instancia = "APROBADO", f"Categoría {cat}, cuota/ingreso {rci * 100:.1f} % y monto dentro del umbral automático.", "MATRIZ_AUTOMATICA"
    else:
        razones = []
        if cat in ("C", "D"):
            razones.append(f"zona gris (categoría {cat})")
        if c["monto"] > UMBRAL_AUTOMATICO:
            razones.append("monto superior a $20,000.00")
        if rci > 0.40:
            razones.append(f"cuota/ingreso de {rci * 100:.1f} %")
        dictamen, motivo, instancia = "SUJETO_VERIFICACION", "Derivado a comité: " + ", ".join(razones) + ".", "MATRIZ_AUTOMATICA"
    factores = sorted(
        [{"factor": f, "valor": v, "aporte": round(a, 3), "efecto": "eleva el riesgo" if a > 0 else "reduce el riesgo"} for f, v, a in contrib],
        key=lambda x: -abs(x["aporte"]))
    return {"cuota": cuota, "rci": rci, "endeud": endeud, "flujo": flujo, "filtros": filtros, "supera": supera,
            "pd": pd, "score": score, "cat": cat, "corte": corte, "dictamen": dictamen, "motivo": motivo,
            "instancia": instancia, "factores": factores}


def condiciones(c, ev, prod, bienes):
    tasa = round(c["tasa"] + AJUSTE_TASA[ev["cat"]], 2)
    monto = c["monto"]
    if ev["rci"] > 0.40:
        max_cuota = 0.40 * c["ingresos"] - c["cuota_sfn"]
        monto = max(prod["montoMinimo"], math.floor(valor_presente(max_cuota, tasa, c["plazo"]) / 50) * 50)
    cuota = cuota_francesa(monto, tasa, c["plazo"])
    tipos = {b["tipo"] for b in bienes}
    if prod["requiereAhorro"]:
        gar, det, encaje = "AHORRO_ENCAJE", "Encaje del 10 % en la cuenta de ahorros", 10.0
    elif monto <= 3000:
        gar, det, encaje = "SOBRE_FIRMAS", "Firma del deudor y cónyuge", 0.0
    elif monto <= UMBRAL_AUTOMATICO:
        gar, det, encaje = "GARANTE_PERSONAL", "Un garante personal con ingresos demostrables", 0.0
    elif tipos & {"CASA", "LOTE", "DEPARTAMENTO", "LOCAL"}:
        gar, det, encaje = "HIPOTECARIA", "Hipoteca abierta sobre el inmueble declarado", 0.0
    elif "VEHICULO" in tipos:
        gar, det, encaje = "PRENDARIA", "Prenda sobre el vehículo declarado", 0.0
    else:
        gar, det, encaje = "GARANTE_PERSONAL", "Dos garantes personales", 0.0
    tea = round(((1 + tasa / 1200) ** 12 - 1) * 100, 2)
    return {"monto": float(monto), "plazo": c["plazo"], "tasa": tasa, "tea": tea, "cuota": cuota,
            "garantia": gar, "detalle": det, "encaje": encaje}


# ---------------------------------------------------------------- generación
def main():
    productos = leer_productos()
    micro = {"MIN": [1, 3, 5, 6], "SIM": [7, 8, 10, 11, 12], "AMP": [13, 15, 16, 17, 18]}
    consumo = [19, 20, 23, 24]
    sql = []
    w = sql.append
    w("-- =====================================================================")
    w("--  05_datos_prueba.sql — DATOS SINTÉTICOS generados por")
    w("--  scripts/generar_datos_prueba.py (no editar a mano)")
    w(f"--  Clave de todas las cuentas demo: {CLAVE_DEMO}")
    w("-- =====================================================================")
    w("SET DEFINE OFF")

    # ---- personal
    for sid, usuario, nombre, rol, agencia in STAFF:
        w(insert("tb_usuario", {"id_usuario": sid, "usuario": usuario, "nombre_completo": nombre, "rol": rol,
                                "agencia": agencia, "correo": f"{usuario}@pjl-credito.test", "clave_hash": clave_hash(CLAVE_DEMO)}))

    # ---- socios
    socios = []
    for i in range(1, 61):
        if i == 1:
            sexo, nombres, ap1, ap2, arq = "F", "María Fernanda", "Jiménez", "Ochoa", ARQUETIPOS[0]
            ubic, edad = UBICACIONES[0], 41
        else:
            sexo = R.choice("FM")
            nombres = R.choice(NOMBRES_F if sexo == "F" else NOMBRES_M)
            ap1, ap2 = R.sample(APELLIDOS, 2)
            arq = R.choice(ARQUETIPOS)
            ubic = R.choice(UBICACIONES)
            edad = R.randint(45, 72) if arq[0] == "JUBILADO" else R.randint(23, 62)
        prov = 19 if ubic[0] == "Zamora Chinchipe" else 11
        ced = cedula(prov)
        civil = "CASADO" if i == 1 else R.choices(["CASADO", "SOLTERO", "UNION_LIBRE", "DIVORCIADO", "VIUDO"], [45, 25, 15, 10, 5])[0]
        antig = 64 if i == 1 else R.randint(4, 180)
        user = (sin_tildes(nombres.split()[0][0] + nombres.split()[1][0] if len(nombres.split()) > 1 else nombres[0]) + sin_tildes(ap1)).lower()
        s = {
            "id": i, "numero": f"PJL-{10200 + i * 7:06d}", "cedula": ced, "nombres": nombres, "ap1": ap1, "ap2": ap2,
            "sexo": sexo, "edad": edad, "civil": civil, "arq": arq, "ubic": ubic, "antig": antig,
            "celular": "09" + "".join(str(R.randint(0, 9)) for _ in range(8)),
            "correo": f"{user}{R.randint(1, 99)}@correo.example",
            "agencia": ubic[4],
        }
        socios.append(s)
        calle = R.choice(ubic[5])
        w(insert("tb_socio", {
            "id_socio": i, "numero_socio": s["numero"], "cedula": ced, "apellido_paterno": ap1, "apellido_materno": ap2,
            "nombres": nombres, "fecha_nacimiento": Raw(fecha(edad * 365 + R.randint(10, 350))), "sexo": sexo,
            "estado_civil": civil, "nacionalidad": "ECUATORIANA", "cargas_familiares": R.randint(0, 4),
            "separacion_bienes": "N",
            "instruccion": R.choice(["PRIMARIA", "SECUNDARIA", "SECUNDARIA", "TECNICO", "UNIVERSITARIO"]) if arq[0] not in ("EMPLEADO_PUBLICO", "HONORARIOS") else "UNIVERSITARIO",
            "profesion": PROFESIONES.get(arq[0], "Comerciante" if arq[0] == "COMERCIANTE" else "Microempresario"),
            "tipo_vivienda": R.choice(["PROPIA", "PROPIA", "ARRENDADA", "FAMILIAR"]),
            "tiempo_residencia_meses": R.randint(12, 240),
            "calle_principal": calle, "calle_transversal": R.choice([c for c in ubic[5] if c != calle] or ["S/N"]),
            "numero_casa": f"{R.randint(1, 30)}-{R.randint(10, 99)}",
            "referencia_ubicacion": R.choice(["Frente al parque", "Junto a la iglesia", "Media cuadra del mercado", "Diagonal a la escuela", "A lado de la farmacia"]),
            "provincia": ubic[0], "canton": ubic[1], "parroquia": ubic[2], "barrio": ubic[3],
            "telefono": "07" + "".join(str(R.randint(0, 9)) for _ in range(7)), "celular": s["celular"],
            "correo": s["correo"], "agencia": s["agencia"], "fecha_ingreso": Raw(fecha(antig * 30.4)),
        }))
    for s in socios:
        w(insert("tb_usuario", {"id_usuario": 100 + s["id"], "usuario": s["cedula"],
                                "nombre_completo": f"{s['nombres']} {s['ap1']} {s['ap2']}", "rol": "SOCIO",
                                "agencia": s["agencia"], "id_socio": s["id"], "clave_hash": clave_hash(CLAVE_DEMO)}))

    # ---- core bancario simulado (cuentas + historial interno) y externos
    core, externos = {}, {}
    for s in socios:
        bueno = R.random() < 0.8
        ahorro = round(R.uniform(150, 6500) if bueno else R.uniform(20, 600), 2)
        cert = round(R.choice([50, 100, 200, 400]) + R.uniform(0, 60), 2)
        pf = round(R.choice([0, 0, 0, 2000, 5000, 10000]) * 1.0, 2)
        mora_hist = 0 if bueno and R.random() < 0.7 else R.randint(1, 45)
        prev = R.randint(0, 5)
        s.update({"ahorro": ahorro, "cert": cert, "pf": pf, "mora_hist": mora_hist, "prev": prev, "bueno": bueno})
        comp = ("SIN_HISTORIAL" if prev == 0 else "EXCELENTE" if mora_hist == 0 else "BUENO" if mora_hist <= 8
                else "REGULAR" if mora_hist <= 30 else "DEFICIENTE")
        s["comp"] = comp
        cuentas = [{"numero": f"40{R.randint(10000000, 99999999)}", "tipo": "AHORRO_VISTA", "nombre": "Ahorro a la vista", "saldo": ahorro, "estado": "ACTIVA"},
                   {"numero": f"41{R.randint(10000000, 99999999)}", "tipo": "CERTIFICADO_APORTACION", "nombre": "Certificados de aportación", "saldo": cert, "estado": "ACTIVA"}]
        if pf:
            cuentas.append({"numero": f"60{R.randint(10000000, 99999999)}", "tipo": "PLAZO_FIJO", "nombre": "Depósito a plazo fijo", "saldo": pf, "estado": "ACTIVA", "plazoDias": 180, "tasa": 7.25})
        s["cuenta"] = cuentas[0]["numero"]
        core[s["cedula"]] = {
            "numeroSocio": s["numero"], "cedula": s["cedula"], "nombres": s["nombres"], "apellidos": f"{s['ap1']} {s['ap2']}",
            "agencia": s["agencia"], "antiguedadMeses": s["antig"], "estado": "ACTIVO", "cuentas": cuentas,
            "historial": {"creditosAnteriores": prev, "creditosCancelados": max(0, prev - (1 if R.random() < 0.3 else 0)),
                          "maxDiasMoraHistorico": mora_hist, "promedioDiasMora": round(mora_hist / 3, 2), "comportamiento": comp},
        }
        sb = R.randint(690, 860) if bueno else R.randint(520, 700)
        externos[s["cedula"]] = {
            "registroCivil": {"cedula": s["cedula"], "nombre": f"{s['ap1'].upper()} {s['ap2'].upper()} {s['nombres'].upper()}", "estadoCedula": "VIGENTE", "condicion": "CIUDADANO"},
            "biometria": {"similitud": round(R.uniform(93.5, 99.6), 2)},
            "listas": {"uafe": "SATISFACTORIO", "ofac": "SATISFACTORIO", "onu": "SATISFACTORIO"},
            "buro": {"score": sb, "operacionesActivas": R.randint(0, 3), "deudaTotal": 0.0, "deudaVencida": 0.0,
                     "cuotaMensual": 0.0, "peorCalificacion": "A1" if bueno else R.choice(["A2", "B1", "B2"]), "maxDiasMora24m": 0 if bueno else R.randint(0, 25), "demandaJudicial": False},
        }

    # ---- plan de solicitudes
    def armar(s, objetivo, rng_monto=None):
        """Genera datos de solicitud hasta que el motor produzca el resultado objetivo."""
        arq = s["arq"]
        for _ in range(400):
            ingreso_base = R.uniform(*arq[4])
            ventas_anuales = round(ingreso_base * 12 * R.uniform(1.6, 4.5), 2)
            if arq[0] in ("EMPLEADO_PUBLICO", "EMPLEADO_PRIVADO", "JUBILADO", "HONORARIOS"):
                prod_id = R.choice(consumo)
            else:
                seg = "MIN" if ventas_anuales <= 20000 else "SIM" if ventas_anuales <= 120000 else "AMP"
                prod_id = R.choice(micro[seg] + ([4] if seg == "MIN" else [9] if seg == "SIM" else [14]))
            prod = productos[prod_id]
            plazo = min(prod["plazoMaximoMeses"], R.choice([6, 12, 18, 24, 36, 48]))
            if rng_monto:
                monto = R.choice(rng_monto)
            else:
                monto = R.choice([500, 800, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000])
            monto = float(min(max(monto, prod["montoMinimo"]), prod["montoMaximo"]))
            casado = s["civil"] in ("CASADO", "UNION_LIBRE")
            conyuge_ing = round(R.uniform(300, 900), 2) if casado and R.random() < 0.6 else 0.0
            ingresos = round(ingreso_base + conyuge_ing + (R.choice([0, 0, 150, 250]) if R.random() < 0.3 else 0), 2)
            gastos_fin = round(R.choice([0, 0, 60, 120, 180, 260]) * (1 if objetivo != "malo" else 2.2), 2)
            egresos = round(ingresos * R.uniform(0.38, 0.62) + gastos_fin, 2)
            if objetivo == "malo":
                egresos = round(ingresos * R.uniform(0.60, 0.85) + gastos_fin, 2)
            activos = round(R.uniform(3000, 90000), 2)
            pasivos = round(activos * R.uniform(0.05, 0.45 if objetivo != "malo" else 0.9), 2)
            ext = externos[s["cedula"]]["buro"]
            deuda_vencida = 0.0 if objetivo != "malo" or R.random() < 0.5 else round(R.uniform(150, 2400), 2)
            ctx = {"monto": monto, "plazo": plazo, "tasa": prod["tasaReferencial"], "ingresos": ingresos,
                   "egresos": egresos, "cuota_sfn": gastos_fin, "activos": activos, "pasivos": pasivos,
                   "score_buro": ext["score"] if objetivo != "malo" else R.randint(470, 620),
                   "deuda_vencida": deuda_vencida, "mora_hist": s["mora_hist"] if objetivo != "malo" else R.randint(15, 60),
                   "antiguedad": s["antig"], "tiempo_trabajo": R.randint(12, 180), "ahorro": s["ahorro"],
                   "peor_calif": ("A" if objetivo != "malo" else R.choice(["B", "C", "D"])), "listas_ok": True,
                   "edad": s["edad"]}
            ev = evaluar(ctx)
            ok = {
                "auto": ev["dictamen"] == "APROBADO",
                "comite": ev["dictamen"] == "SUJETO_VERIFICACION",
                "malo": ev["dictamen"] == "RECHAZADO",
                "cualquiera": True,
            }[objetivo]
            if ok:
                return {"prod": prod, "ctx": ctx, "ev": ev, "conyuge_ing": conyuge_ing, "ventas": ventas_anuales,
                        "gastos_fin": gastos_fin}
        return None

    def mejorar(s):
        """Perfil sano y coherente en core y buró cuando el objetivo exige aprobación."""
        s.update({"bueno": True, "mora_hist": 0, "comp": "EXCELENTE" if s["prev"] else "SIN_HISTORIAL"})
        core[s["cedula"]]["historial"].update({"maxDiasMoraHistorico": 0, "promedioDiasMora": 0.0, "comportamiento": s["comp"]})
        externos[s["cedula"]]["buro"].update({"score": R.randint(720, 840), "peorCalificacion": "A1", "maxDiasMora24m": 0})

    def generar(s, objetivo, rng_monto=None):
        d = armar(s, objetivo, rng_monto)
        if d is None and objetivo in ("auto", "comite"):
            mejorar(s)
            d = armar(s, objetivo, rng_monto) or armar(s, objetivo, [500, 800, 1000, 1500, 2000])
        if d is None:
            raise RuntimeError(f"No se pudo generar objetivo {objetivo} para socio {s['id']}")
        return d

    credito_perfiles = (["al_dia"] * 30 + ["mora_temprana"] * 6 + ["mora_media"] * 2 + ["judicial"] * 2)
    plan = []
    # Créditos históricos: socios 1..40
    for idx, perfil in enumerate(credito_perfiles):
        s = socios[idx]
        if s["id"] == 1:
            plan.append({"socio": s, "meta": "6.1", "perfil": "al_dia", "obj": "auto", "dias_desembolso": 245, "plazo_fijo": 24, "monto_fijo": 6000})
            continue
        if perfil == "al_dia":
            dd = R.randint(20, 900)
        elif perfil == "mora_temprana":
            dd = R.randint(120, 600)
        elif perfil == "mora_media":
            dd = R.randint(200, 700)
        else:
            dd = R.randint(300, 800)
        plan.append({"socio": s, "meta": "6.1", "perfil": perfil, "obj": "comite_ok" if idx % 8 == 3 else "auto", "dias_desembolso": dd})
    # Socios disponibles para el pipeline: al día (no 1) + nuevos 41..60
    disponibles = [p["socio"] for p in plan if p["perfil"] == "al_dia" and p["socio"]["id"] != 1] + socios[40:]
    R.shuffle(disponibles)
    morosos = [p["socio"] for p in plan if p["perfil"] in ("mora_media", "judicial")]
    pipeline = ([("1.1", "cualquiera")] * 3 + [("1.2", "cualquiera")] * 3 + [("1.3", "cualquiera")] * 4 +
                [("2.1", "cualquiera")] * 2 + [("2.2", "cualquiera")] * 3 + [("2.3", "cualquiera")] * 2 +
                [("3.1", "cualquiera")] * 3 + [("4.2", "comite")] * 5 + [("4.3", "auto")] * 2 +
                [("5.2", "auto")] * 3 + [("5.1", "auto")] * 3)
    for meta, obj in pipeline:
        plan.append({"socio": disponibles.pop(), "meta": meta, "obj": obj})
    plan.append({"socio": socios[0], "meta": "5.1", "obj": "auto", "monto_fijo": 8500, "plazo_fijo": 24, "demo": True})
    for k in range(6):
        s = morosos[k % len(morosos)] if k < 3 else disponibles.pop()
        plan.append({"socio": s, "meta": "RECHAZADA", "obj": "malo"})

    # ---- emitir solicitudes
    id_consent = 0
    id_kyc = id_doc = id_ref = id_bien = id_act = id_cony = id_cext = id_eval = id_dec = id_hist = 0
    creditos = []
    consent_de_socio = {}
    for sol_id, p in enumerate(plan, start=1):
        s = p["socio"]
        meta = p["meta"]
        obj = {"comite_ok": "comite"}.get(p["obj"], p["obj"])
        rng = [p["monto_fijo"]] if p.get("monto_fijo") else ([22000, 25000, 30000, 35000, 40000] if (meta == "4.2" and R.random() < 0.5) or p["obj"] == "comite_ok" else None)
        d = generar(s, obj, rng)
        if p.get("plazo_fijo"):
            d["ctx"]["plazo"] = min(p["plazo_fijo"], d["prod"]["plazoMaximoMeses"])
            d["ev"] = evaluar(d["ctx"])
        prod, ctx, ev = d["prod"], d["ctx"], d["ev"]
        if meta == "6.1":
            p["skip"] = {"al_dia": 0, "mora_temprana": 1, "mora_media": R.choice([2, 3]), "judicial": R.choice([4, 5, 6])}[p["perfil"]]
            if p["perfil"] != "al_dia":
                # La mora queda en las cuotas más recientes: días de mora ≈ cuotas impagas × 30
                lo = (p["skip"] + 1) * 31 + 3
                hi = max(lo, (ctx["plazo"] - 1) * 30 - 10)
                p["dias_desembolso"] = R.randint(lo, min(hi, lo + 150)) if hi > lo else lo
        rechazada = meta == "RECHAZADA"
        hasta = ("4.1" if ev["dictamen"] == "RECHAZADO" or R.random() < 0.5 else "4.2") if rechazada else meta
        if rechazada and ev["dictamen"] != "RECHAZADO":
            hasta = "4.2"
        n_hasta = ORDEN.index(hasta)
        # fechas
        if meta == "6.1":
            t0 = p["dias_desembolso"] + R.uniform(1.6, 5.5)
        elif rechazada:
            t0 = R.uniform(6, 45)
        else:
            t0 = {1: R.uniform(0.05, 1.5), 2: R.uniform(0.4, 2.5), 3: R.uniform(0.6, 3), 4: R.uniform(1.5, 6), 5: R.uniform(2.5, 9)}[ETAPA_DE[meta]]
        canal = "MOVIL" if (p.get("demo") or R.random() < 0.35) else "AGENCIA"
        asesor = 3 if s["agencia"] == "Catamayo" else 2
        actor_asesor = "Socio (app móvil)" if canal == "MOVIL" else STAFF[asesor - 1][2]
        # consentimiento LOPDP (canal móvil lo firma al enviar; en agencia tras KYC)
        cid = None
        if n_hasta >= ORDEN.index("1.2") or canal == "MOVIL":
            if s["id"] in consent_de_socio and R.random() < 0.6:
                cid = consent_de_socio[s["id"]]
            else:
                id_consent += 1
                cid = id_consent
                consent_de_socio[s["id"]] = cid
                firma = hashlib.sha256(f"{s['cedula']}|{sol_id}|{CLAVE_DEMO}".encode()).hexdigest()
                w(insert("tb_consentimiento_lopdp", {
                    "id_consentimiento": cid, "id_socio": s["id"], "nombres": f"{s['nombres']} {s['ap1']} {s['ap2']}",
                    "cedula": s["cedula"], "celular": s["celular"], "correo": s["correo"], "actividad_economica": s["arq"][2],
                    "canal": "MOVIL" if canal == "MOVIL" else "AGENCIA", "firma_hash": firma,
                    "ip_origen": "10.20.1." + str(R.randint(2, 250)) if canal == "AGENCIA" else "190.95." + str(R.randint(1, 250)) + "." + str(R.randint(1, 250)),
                    "fecha_otorgamiento": Raw(hace(t0 - 0.01)), "vigente_hasta": Raw(f"ADD_MONTHS(TRUNC(SYSDATE) - {int(t0)}, 24)"),
                }))
        etapa_final = "5.1" if meta == "6.1" else ("4.1" if rechazada and hasta == "4.1" else hasta)
        estado = ("RECHAZADA" if rechazada else "EN_COMITE" if meta == "4.2" else
                  "APROBADA" if meta in ("4.3", "5.1", "5.2", "6.1") else "EN_PROCESO")
        dictamen = None
        if rechazada:
            dictamen = "RECHAZADO"
        elif n_hasta >= ORDEN.index("4.1"):
            dictamen = "APROBADO" if estado == "APROBADA" else ev["dictamen"]
        horas = [0.0]
        for _ in range(n_hasta):
            horas.append(horas[-1] + R.uniform(0.05, 0.6 if canal == "MOVIL" else 3))
        horas = [min(h, t0 * 24 * 0.92) for h in horas]
        t_evento = lambda k: t0 - horas[min(k, len(horas) - 1)] / 24
        fecha_etapa = t_evento(ORDEN.index(etapa_final) if etapa_final in ORDEN else n_hasta)
        primera = next(i for i, x in enumerate(ORDEN) if ETAPA_DE[x] == ETAPA_DE[etapa_final])
        fecha_etapa = t_evento(primera)
        w(insert("tb_solicitud_credito", {
            "id_solicitud": sol_id, "id_socio": s["id"], "id_producto": prod["id"], "id_consentimiento": cid,
            "tipo_credito": prod["segmento"], "tipo_pago": "FIJO", "calidad": "DEUDOR", "destino": s["arq"][6],
            "monto_solicitado": ctx["monto"], "plazo_meses": ctx["plazo"], "canal": canal, "agencia": s["agencia"],
            "id_asesor": None if canal == "MOVIL" and n_hasta < 2 else asesor,
            "id_etapa": ETAPA_DE[etapa_final], "id_subetapa": etapa_final, "estado": estado, "dictamen": dictamen,
            "es_pep": "N", "declara_licitud": "S",
            "croquis_casa_lat": round(s["ubic"][6] + R.uniform(-0.01, 0.01), 6), "croquis_casa_lng": round(s["ubic"][7] + R.uniform(-0.01, 0.01), 6),
            "croquis_negocio_lat": round(s["ubic"][6] + R.uniform(-0.01, 0.01), 6) if s["arq"][5] else None,
            "croquis_negocio_lng": round(s["ubic"][7] + R.uniform(-0.01, 0.01), 6) if s["arq"][5] else None,
            "fecha_solicitud": Raw(hace(t0)), "fecha_etapa": Raw(hace(fecha_etapa)),
            "fecha_cierre": Raw(hace(t_evento(n_hasta) - 0.01)) if rechazada else None,
        }))
        # actividad económica 1 (+2 a veces)
        arq = s["arq"]
        id_act += 1
        independiente = arq[0] in ("COMERCIANTE", "NEGOCIO_PROPIO", "HONORARIOS")
        w(insert("tb_actividad_economica", {
            "id_actividad": id_act, "id_solicitud": sol_id, "orden": 1, "condicion": arq[0], "empresa": arq[1] + ("" if not independiente else f" {s['ap1']}"),
            "actividad_empresa": arq[2], "sector": arq[3], "cargo": "Propietario" if independiente else ("Jubilado" if arq[0] == "JUBILADO" else "Servidor"),
            "tipo_contratacion": None if independiente or arq[0] == "JUBILADO" else R.choice(["CONTRATO", "NOMBRAMIENTO"]),
            "tipo_ingresos": "VARIABLE" if independiente else "FIJO", "afiliacion": "IESS" if R.random() < 0.7 else "NINGUNO",
            "tiempo_trabajo_meses": ctx["tiempo_trabajo"], "numero_trabajadores": R.randint(0, 6) if independiente else None,
            "horas_trabajo": R.choice([8, 9, 10, 12]), "tiempo_mercado_meses": ctx["tiempo_trabajo"] if independiente else None,
            "local_propio": ("S" if R.random() < 0.4 else "N") if independiente else None, "productos": arq[5],
            "direccion": f"{R.choice(s['ubic'][5])} y {R.choice(s['ubic'][5])}", "provincia": s["ubic"][0], "canton": s["ubic"][1],
            "parroquia": s["ubic"][2], "barrio": s["ubic"][3], "telefono": "07" + str(R.randint(2000000, 2999999)),
            "ventas_anuales": d["ventas"] if independiente else None,
        }))
        # cónyuge
        if s["civil"] in ("CASADO", "UNION_LIBRE"):
            id_cony += 1
            sexo_c = "M" if s["sexo"] == "F" else "F"
            w(insert("tb_conyuge", {
                "id_conyuge": id_cony, "id_solicitud": sol_id, "cedula": cedula(11),
                "apellidos": " ".join(R.sample(APELLIDOS, 2)), "nombres": R.choice(NOMBRES_M if sexo_c == "M" else NOMBRES_F),
                "fecha_nacimiento": Raw(fecha(R.randint(25, 60) * 365)), "nacionalidad": "ECUATORIANA",
                "instruccion": R.choice(["SECUNDARIA", "TECNICO", "UNIVERSITARIO"]),
                "condicion_laboral": "EMPLEADO_PRIVADO" if d["conyuge_ing"] else "QUEHACERES_DOMESTICOS",
                "actividad": "Ventas" if d["conyuge_ing"] else "Hogar", "celular": "09" + str(R.randint(60000000, 99999999)),
            }))
        # referencias
        for tipo in ("CUENTA_BANCARIA", "PERSONAL", "PERSONAL", "COMERCIAL"):
            id_ref += 1
            fila = {"id_referencia": id_ref, "id_solicitud": sol_id, "tipo": tipo}
            if tipo == "CUENTA_BANCARIA":
                fila.update({"nombre": R.choice(["Banco de Loja", "Banco Pichincha", "BanEcuador", "Cooperativa JEP"]), "tipo_cuenta": "AHORROS", "numero_cuenta": "****" + str(R.randint(1000, 9999))})
            elif tipo == "COMERCIAL":
                fila.update({"nombre": R.choice(["Distribuidora del Sur", "Comercial Loja", "Almacenes Zamora", "Agroinsumos del Valle"]), "direccion": s["ubic"][3], "telefono": "07" + str(R.randint(2500000, 2599999))})
            else:
                fila.update({"nombre": f"{R.choice(NOMBRES_F + NOMBRES_M)} {R.choice(APELLIDOS)}", "direccion": f"{s['ubic'][3]}, {s['ubic'][1]}",
                             "telefono": "09" + str(R.randint(60000000, 99999999)), "parentesco": R.choice(["Hermano/a", "Vecino/a", "Amigo/a", "Primo/a", "Compadre"])})
            w(insert("tb_referencia", fila))
        # bienes
        bienes = []
        if R.random() < 0.65:
            bienes.append({"tipo": R.choice(["CASA", "LOTE", "DEPARTAMENTO"]), "descripcion": f"{s['ubic'][1]}, {s['ubic'][3]}", "valor": round(R.uniform(18000, 85000), -2)})
        if R.random() < 0.35:
            bienes.append({"tipo": "VEHICULO", "descripcion": f"{R.choice(['Chevrolet D-Max', 'Kia Rio', 'Hyundai Accent', 'Toyota Hilux'])} {R.randint(2012, 2024)}", "valor": round(R.uniform(7000, 28000), -2)})
        for b in bienes:
            id_bien += 1
            w(insert("tb_bien", {"id_bien": id_bien, "id_solicitud": sol_id, "tipo": b["tipo"], "descripcion": b["descripcion"],
                                 "valor_comercial": b["valor"], "hipotecado": "N"}))
        # situación financiera (cuadra con el contexto del motor)
        ing, egr = ctx["ingresos"], ctx["egresos"]
        principal = round(ing - d["conyuge_ing"], 2)
        inm = sum(b["valor"] for b in bienes if b["tipo"] != "VEHICULO")
        veh = sum(b["valor"] for b in bienes if b["tipo"] == "VEHICULO")
        resto_act = max(0.0, round(ctx["activos"] - inm - veh, 2))
        alim, serv, transp, educ = round(egr * 0.38, 2), round(egr * 0.08, 2), round(egr * 0.10, 2), round(egr * 0.10, 2)
        arriendo = 0.0
        salud = round(egr * 0.06, 2)
        vest = round(egr * 0.05, 2)
        otros_e = round(egr - alim - serv - transp - educ - salud - vest - d["gastos_fin"], 2)
        w(insert("tb_situacion_financiera", {
            "id_solicitud": sol_id, "efectivo": round(resto_act * 0.1, 2), "bancos": round(s["ahorro"], 2),
            "mobiliario": round(resto_act * 0.3, 2), "vehiculos": veh, "bienes_inmuebles": inm,
            "cuentas_por_cobrar": round(resto_act * 0.15, 2), "otros_activos": round(resto_act * 0.45 - s["ahorro"], 2) if resto_act * 0.45 > s["ahorro"] else 0.0,
            "cuentas_por_pagar": round(ctx["pasivos"] * 0.2, 2),
            "deudas_sfn_microcredito": round(ctx["pasivos"] * 0.5, 2) if independiente else 0.0,
            "deudas_sfn_consumo": round(ctx["pasivos"] * 0.3, 2) if independiente else round(ctx["pasivos"] * 0.8, 2),
            "otros_pasivos": round(ctx["pasivos"] - round(ctx["pasivos"] * 0.2, 2) - (round(ctx["pasivos"] * 0.5, 2) if independiente else 0.0) - (round(ctx["pasivos"] * 0.3, 2) if independiente else round(ctx["pasivos"] * 0.8, 2)), 2),
            "sueldo": 0.0 if independiente else (0.0 if arq[0] == "JUBILADO" else principal),
            "pension_jubilacion": principal if arq[0] == "JUBILADO" else 0.0,
            "ingreso_ventas": principal if independiente else 0.0, "sueldo_conyuge": d["conyuge_ing"],
            "alimentacion": alim, "arriendo": arriendo, "servicios_basicos": serv, "gastos_financieros": d["gastos_fin"],
            "transporte": transp, "educacion": educ, "salud": salud, "vestimenta": vest, "otros_egresos": max(otros_e, 0.0),
        }))
        # Ajuste fino: la base debe sumar exactamente lo que vio el motor
        # (otros_activos puede quedar en 0; el motor usa los valores del contexto).
        hist = []

        def evento(sub, ev_txt, det, actor="Sistema", visible="S"):
            hist.append((sub, ev_txt, det, actor, visible, t_evento(ORDEN.index(sub))))

        evento("1.1", "Solicitud registrada", f"{prod['nombre']} por ${ctx['monto']:,.2f} a {ctx['plazo']} meses. Canal: {'app móvil' if canal == 'MOVIL' else 'agencia ' + s['agencia']}.", actor_asesor)
        x = externos[s["cedula"]]
        if n_hasta >= ORDEN.index("1.2"):
            evento("1.2", "Validación de identidad (KYC)", "Pendiente de verificación biométrica y listas restrictivas.", STAFF[asesor - 1][2])
        if n_hasta >= ORDEN.index("1.3"):
            id_kyc += 1
            w(insert("tb_validacion_kyc", {
                "id_kyc": id_kyc, "id_solicitud": sol_id, "cedula_verificada": "S", "nombre_registro_civil": x["registroCivil"]["nombre"],
                "biometria_validada": "S", "similitud_biometrica": x["biometria"]["similitud"], "lista_uafe": "SATISFACTORIO",
                "lista_ofac": "SATISFACTORIO", "lista_onu": "SATISFACTORIO", "resultado": "APROBADO",
                "id_usuario": asesor, "fecha": Raw(hace(t_evento(ORDEN.index("1.3")))),
            }))
            evento("1.3", "Identidad verificada", f"Cédula vigente, biometría {x['biometria']['similitud']:.1f} %, listas UAFE, OFAC y ONU satisfactorias.".replace(".", ",", 1) if False else f"Cédula vigente, biometría {x['biometria']['similitud']:.1f} %, listas UAFE/OFAC/ONU satisfactorias.", STAFF[asesor - 1][2])
            docs = ["CEDULA", "PLANILLA_SERVICIO"] + (["RUC_RISE", "DECLARACION_SRI"] if independiente else ["ROL_PAGOS"])
            if n_hasta < ORDEN.index("2.1") and R.random() < 0.5:
                docs = docs[:2]
            numero = f"SC-$ANIO-{sol_id:06d}"
            for tdoc in docs:
                id_doc += 1
                nombre = {"CEDULA": "cedula.pdf", "PLANILLA_SERVICIO": "planilla-luz.pdf", "RUC_RISE": "ruc.pdf", "DECLARACION_SRI": "declaracion-iva.pdf", "ROL_PAGOS": "rol-pagos.pdf"}[tdoc]
                w(insert("tb_documento", {
                    "id_documento": id_doc, "id_solicitud": sol_id, "tipo": tdoc, "nombre_archivo": nombre, "tipo_mime": "application/pdf",
                    "tamano_bytes": R.randint(80000, 900000), "uri_expediente": f"nube-privada://expediente/{s['cedula']}/{sol_id}/{nombre}",
                    "hash_sha256": hashlib.sha256(f"{sol_id}{nombre}".encode()).hexdigest(),
                    "estado": "VALIDADO" if n_hasta >= ORDEN.index("2.1") else "RECIBIDO", "cargado_por": "socio" if canal == "MOVIL" else "dmaldonado",
                    "fecha_carga": Raw(hace(t_evento(ORDEN.index("1.3")) + 0.002)),
                }))
        if n_hasta >= ORDEN.index("2.1"):
            evento("1.3", "Documentos recibidos", "Expediente digital completo en la nube privada.", STAFF[asesor - 1][2])
            evento("2.1", "Recolección de datos internos", "Consulta al core bancario en curso.")
        if n_hasta >= ORDEN.index("2.2"):
            c = core[s["cedula"]]
            w(insert("tb_datos_internos", {
                "id_solicitud": sol_id, "antiguedad_meses": s["antig"], "saldo_ahorros": s["ahorro"], "saldo_certificados": s["cert"],
                "saldo_plazo_fijo": s["pf"], "creditos_anteriores": c["historial"]["creditosAnteriores"],
                "creditos_cancelados": c["historial"]["creditosCancelados"], "max_dias_mora_historico": ctx["mora_hist"],
                "promedio_dias_mora": round(ctx["mora_hist"] / 3, 2), "comportamiento": s["comp"],
                "fecha_consulta": Raw(hace(t_evento(ORDEN.index("2.2")))),
            }))
            evento("2.2", "Datos internos consultados", f"Socio desde hace {s['antig']} meses; comportamiento {s['comp'].replace('_', ' ').lower()}.")
        if n_hasta >= ORDEN.index("2.3"):
            peor = {"A": "A1", "B": "B1", "C": "C1", "D": "D", "E": "E"}.get(ctx["peor_calif"], "A1")
            for fuente in ("BURO_CREDITO", "CENTRAL_RIESGOS_SEPS"):
                id_cext += 1
                w(insert("tb_consulta_externa", {
                    "id_consulta": id_cext, "id_solicitud": sol_id, "id_consentimiento": cid, "fuente": fuente,
                    "score_buro": ctx["score_buro"] if fuente == "BURO_CREDITO" else None,
                    "operaciones_activas": 1 if ctx["cuota_sfn"] else 0, "deuda_total": round(ctx["cuota_sfn"] * 18, 2),
                    "deuda_vencida": ctx["deuda_vencida"], "cuota_mensual_sfn": ctx["cuota_sfn"], "peor_calificacion": peor,
                    "max_dias_mora_24m": 0 if not ctx["deuda_vencida"] else R.randint(31, 120), "en_demanda_judicial": "N",
                    "fecha_consulta": Raw(hace(t_evento(ORDEN.index("2.3")))),
                }))
            evento("2.3", "Buró y central de riesgos consultados", "Consulta autorizada por el socio (LOPDP).")
        if n_hasta >= ORDEN.index("3.1"):
            evento("3.1", "Datos integrados y depurados", "Variables normalizadas para el modelo.")
        if n_hasta >= ORDEN.index("3.2"):
            id_eval += 1
            f = ev["filtros"]
            w(insert("tb_evaluacion", {
                "id_evaluacion": id_eval, "id_solicitud": sol_id, "calidad_datos_pct": round(R.uniform(91, 100), 2),
                "valores_imputados": R.randint(0, 3), "inconsistencias_depuradas": R.randint(0, 2),
                "filtro_edad": f["edad"], "filtro_capacidad_minima": f["capacidad"], "filtro_mora_vigente": f["mora"],
                "filtro_sobreendeudamiento": f["sobreendeudamiento"], "filtro_listas": f["listas"], "supera_filtros": ev["supera"],
                "ingreso_mensual": ctx["ingresos"], "gasto_mensual": ctx["egresos"], "cuota_propuesta": ev["cuota"],
                "cuotas_sfn": ctx["cuota_sfn"], "ratio_cuota_ingreso": round(ev["rci"], 4), "nivel_endeudamiento": round(min(ev["endeud"], 99), 4),
                "flujo_disponible": round(ev["flujo"], 2), "probabilidad_default": round(ev["pd"], 5), "score": ev["score"],
                "modelo": "logit-pjl-v1.2", "categoria_riesgo": ev["cat"], "punto_corte": ev["corte"],
                "factores": json.dumps(ev["factores"], ensure_ascii=False),
                "fecha_evaluacion": Raw(hace(t_evento(ORDEN.index("3.2")))),
            }))
            evento("3.2", "Filtros de política", "Supera los filtros de política." if ev["supera"] else ev["motivo"])
        if n_hasta >= ORDEN.index("4.1"):
            evento("3.3", "Capacidad de pago analizada", f"Cuota/ingreso {ev['rci'] * 100:.1f} %; flujo disponible ${ev['flujo']:,.2f}.")
            evento("3.4", "Score calculado", f"Score {ev['score']}, probabilidad de default {ev['pd'] * 100:.2f} %.", visible="N")
            evento("4.1", "Categoría de riesgo asignada", f"Categoría {ev['cat']} (corte {ev['corte']}).", visible="N")
            id_dec += 1
            w(insert("tb_decision", {
                "id_decision": id_dec, "id_solicitud": sol_id, "instancia": "MATRIZ_AUTOMATICA", "dictamen": ev["dictamen"],
                "cruce_score_monto": f"Score {ev['score']} / ${ctx['monto']:,.2f}", "cumple_politica": ev["supera"],
                "motivo": ev["motivo"], "fecha": Raw(hace(t_evento(ORDEN.index("4.1")))),
            }))
            txt = {"APROBADO": "Dictamen automático: aprobado", "RECHAZADO": "Dictamen automático: rechazado", "SUJETO_VERIFICACION": "Derivado a revisión de comité"}[ev["dictamen"]]
            if n_hasta >= ORDEN.index("4.2") or ev["dictamen"] != "SUJETO_VERIFICACION":
                pass
            hist.append(("4.1" if ev["dictamen"] != "SUJETO_VERIFICACION" else "4.2", txt, ev["motivo"], "Motor de decisión", "S", t_evento(ORDEN.index("4.1")) - 0.0005))
        comite_aprueba = ev["dictamen"] == "SUJETO_VERIFICACION" and (estado == "APROBADA")
        comite_rechaza = ev["dictamen"] == "SUJETO_VERIFICACION" and rechazada
        if comite_aprueba or comite_rechaza:
            id_dec += 1
            w(insert("tb_decision", {
                "id_decision": id_dec, "id_solicitud": sol_id, "instancia": "COMITE",
                "dictamen": "APROBADO" if comite_aprueba else "RECHAZADO", "cruce_score_monto": f"Score {ev['score']} / ${ctx['monto']:,.2f}",
                "cumple_politica": "S" if comite_aprueba else "N",
                "motivo": "Comité aprueba: negocio estable y buen historial de ahorro." if comite_aprueba else "Comité rechaza: capacidad de pago insuficiente para el monto solicitado.",
                "acta": f"AC-{2026}-{100 + id_dec:03d}", "votos_favor": 3 if comite_aprueba else 1, "votos_contra": 0 if comite_aprueba else 2,
                "id_usuario": 6, "fecha": Raw(hace(t_evento(ORDEN.index("4.2")))),
            }))
            hist.append(("4.2", "Resolución del comité de crédito", "Aprobado por comité." if comite_aprueba else "Rechazado por comité.", "Comité de crédito", "S", t_evento(ORDEN.index("4.2"))))
        if estado in ("APROBADA",):
            cond = condiciones(ctx, ev, prod, bienes)
            aceptada = meta in ("5.2", "6.1")
            w(insert("tb_condicion_credito", {
                "id_solicitud": sol_id, "monto_aprobado": cond["monto"], "plazo_meses": cond["plazo"], "tasa_nominal": cond["tasa"],
                "tasa_efectiva": cond["tea"], "cuota_mensual": cond["cuota"], "tipo_garantia": cond["garantia"],
                "detalle_garantia": cond["detalle"], "encaje_ahorro_pct": cond["encaje"], "definido_por": 4,
                "fecha": Raw(hace(t_evento(ORDEN.index("4.3")))), "aceptada_socio": aceptada,
                "fecha_aceptacion": Raw(hace(t_evento(ORDEN.index("5.1")))) if aceptada else None,
                "contrato_firmado": aceptada, "pagare_firmado": aceptada, "garantias_constituidas": aceptada,
            }))
            if meta != "4.3":
                hist.append(("4.3", "Condiciones definidas", f"${cond['monto']:,.2f} a {cond['plazo']} meses, tasa {cond['tasa']:.2f} %, cuota ${cond['cuota']:,.2f}.".replace(f"{cond['tasa']:.2f}", f"{cond['tasa']:.2f}".replace(".", ",")), "Paola Espinosa", "S", t_evento(ORDEN.index("4.3"))))
                hist.append(("5.1", "Oferta enviada al socio", "Revisa y acepta las condiciones para continuar.", "Sistema", "S", t_evento(ORDEN.index("4.3")) - 0.001))
            if aceptada:
                hist.append(("5.1", "Oferta aceptada y documentos firmados", "Contrato, pagaré y garantías formalizados.", "Socio", "S", t_evento(ORDEN.index("5.1"))))
                if meta == "5.2":
                    hist.append(("5.2", "Listo para desembolso", "Operaciones verifica el expediente y acredita los fondos.", "Sistema", "S", t_evento(ORDEN.index("5.1")) - 0.001))
            if meta == "6.1":
                creditos.append({"sol": sol_id, "socio": s, "perfil": p["perfil"], "dias": p["dias_desembolso"], "cond": cond, "skip": p["skip"]})
        if rechazada:
            hist.append((hasta, "Solicitud cerrada", "La solicitud no fue aprobada. Tu asesor te explicará las alternativas.", "Sistema", "S", t_evento(n_hasta) - 0.01))
        # Ajuste de subetapa para solicitudes listas para desembolso / aceptación
        for sub, ev_txt, det, actor, visible, t in hist:
            id_hist += 1
            w(insert("tb_historial_solicitud", {
                "id_historial": id_hist, "id_solicitud": sol_id, "id_subetapa": sub, "evento": ev_txt, "detalle": det,
                "visible_socio": visible, "actor": actor, "fecha": Raw(hace(max(t, 0.0005))),
            }))

    # ---- reinicio de identidades tras inserts con ID explícito
    w("-- Reinicia las columnas IDENTITY después de los IDs explícitos")
    for tabla, col in [("tb_socio", "id_socio"), ("tb_usuario", "id_usuario"), ("tb_consentimiento_lopdp", "id_consentimiento"),
                       ("tb_solicitud_credito", "id_solicitud"), ("tb_actividad_economica", "id_actividad"), ("tb_conyuge", "id_conyuge"),
                       ("tb_referencia", "id_referencia"), ("tb_bien", "id_bien"), ("tb_validacion_kyc", "id_kyc"),
                       ("tb_documento", "id_documento"), ("tb_consulta_externa", "id_consulta"), ("tb_evaluacion", "id_evaluacion"),
                       ("tb_decision", "id_decision"), ("tb_historial_solicitud", "id_historial")]:
        w(f"ALTER TABLE {tabla} MODIFY {col} GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE);")
    # ---- desembolsos, pagos, cartera y provisiones (vía PL/SQL)
    w("")
    w("-- Desembolsos históricos y pagos (usa pkg_credito)")
    for cr in creditos:
        skip = cr["skip"]
        atraso_extra = 3 if cr["perfil"] == "al_dia" and R.random() < 0.15 else 0
        canal = R.choice(["VENTANILLA", "VENTANILLA", "MOVIL", "DEBITO_AUTOMATICO"])
        w(f"""DECLARE
  v_id NUMBER; v_pago NUMBER; v_vencidas NUMBER;
BEGIN
  pkg_credito.desembolsar({cr['sol']}, '{cr['socio']['cuenta']}', 'Luis Burneo', v_id, TRUNC(SYSDATE) - {cr['dias']});
  SELECT COUNT(*) INTO v_vencidas FROM tb_cuota WHERE id_credito = v_id AND fecha_vencimiento < TRUNC(SYSDATE);
  FOR c IN (SELECT numero, valor_cuota, fecha_vencimiento FROM tb_cuota
             WHERE id_credito = v_id AND fecha_vencimiento < TRUNC(SYSDATE) ORDER BY numero) LOOP
    EXIT WHEN c.numero > v_vencidas - {skip};
    pkg_credito.registrar_pago(v_id, c.valor_cuota, '{canal}', 'REC-' || LPAD(v_id, 5, '0') || '-' || c.numero, 'Caja', v_pago,
                               CAST(c.fecha_vencimiento AS TIMESTAMP) + NUMTODSINTERVAL({R.randint(-4, 0) + atraso_extra}, 'DAY') + INTERVAL '11' HOUR);
  END LOOP;
END;
/""")
    w("BEGIN pkg_credito.actualizar_cartera(TRUNC(SYSDATE)); END;")
    w("/")

    # Gestiones de cobranza para créditos en mora
    w("-- Gestiones de cobranza (6.2)")
    for cr in creditos:
        if cr["perfil"] == "al_dia":
            continue
        fases = {"mora_temprana": [("TEMPRANA", "LLAMADA", "PROMESA_PAGO")],
                 "mora_media": [("TEMPRANA", "MENSAJE", "NO_CONTACTADO"), ("TEMPRANA", "LLAMADA", "CONTACTADO"), ("TEMPRANA", "VISITA", "PROMESA_PAGO")],
                 "judicial": [("TEMPRANA", "LLAMADA", "NO_CONTACTADO"), ("TEMPRANA", "VISITA", "RENUENTE"), ("JUDICIAL", "NOTIFICACION", "RENUENTE")]}[cr["perfil"]]
        for k, (fase, accion, res) in enumerate(fases):
            dias = 3 + (len(fases) - k) * R.randint(6, 12)
            w(f"INSERT INTO tb_gestion_cobranza (id_credito, fase, accion, resultado, fecha_compromiso, monto_compromiso, observacion, id_usuario, fecha) "
              f"SELECT id_credito, {q(fase)}, {q(accion)}, {q(res)}, "
              f"{'TRUNC(SYSDATE) + ' + str(R.randint(2, 9)) if res == 'PROMESA_PAGO' else 'NULL'}, "
              f"{'cuota_mensual' if res == 'PROMESA_PAGO' else 'NULL'}, "
              f"{q({'PROMESA_PAGO': 'El socio se compromete a pagar la cuota vencida.', 'NO_CONTACTADO': 'No contesta; se deja mensaje.', 'CONTACTADO': 'Indica retraso en ventas del negocio.', 'RENUENTE': 'No reconoce el saldo; se escala.'}[res])}, "
              f"9, {hace(dias)} FROM tb_credito WHERE id_solicitud = {cr['sol']};")
        if cr["perfil"] == "judicial":
            w(f"UPDATE tb_credito SET estado = 'JUDICIAL' WHERE id_solicitud = {cr['sol']};")
    w("UPDATE tb_alerta_cartera SET atendida = 'S' WHERE id_credito IN (SELECT id_credito FROM tb_gestion_cobranza WHERE resultado = 'PROMESA_PAGO');")
    w("BEGIN pkg_credito.calcular_provisiones(TO_CHAR(SYSDATE, 'YYYY-MM')); END;")
    w("/")

    w("COMMIT;")

    texto = "\n".join(sql).replace("SC-$ANIO-", "SC-")
    SALIDA_SQL.write_text(texto + "\n", encoding="utf-8")

    # ---- archivos del simulador
    (SIM / "nube").mkdir(parents=True, exist_ok=True)
    (SIM / "core-bancario.json").write_text(json.dumps(core, ensure_ascii=False, indent=1), encoding="utf-8")
    (SIM / "externos.json").write_text(json.dumps(externos, ensure_ascii=False, indent=1), encoding="utf-8")
    requisitos = {
        "MICROCREDITO": ["Cédula de identidad y certificado de votación", "Planilla de un servicio básico", "RUC o RISE del negocio",
                         "Declaraciones de IVA de los últimos 6 meses", "Croquis del domicilio y del negocio"],
        "CONSUMO": ["Cédula de identidad y certificado de votación", "Planilla de un servicio básico",
                    "Rol de pagos de los últimos 3 meses o certificado de ingresos", "Croquis del domicilio"],
    }
    catalogo = []
    for p in productos.values():
        catalogo.append({**p, "requisitos": requisitos[p["segmento"]],
                         "beneficios": (["Ahorro programado que crece contigo"] if p["requiereAhorro"] else []) +
                                       ["Tasa preferencial con certificados de aportación"] * (1 if p["tasaConAportacion"] else 0) +
                                       ["Respuesta en línea para montos dentro del umbral automático"]})
    meta = {"fuente": "Nube privada COAC PJL (simulada)", "nota": "Datos de prueba: el tarifario fue transcrito de la hoja física y debe validarse.", "version": "2026-11"}
    (SIM / "nube/productos.json").write_text(json.dumps({"meta": meta, "productos": catalogo}, ensure_ascii=False, indent=1), encoding="utf-8")
    (SIM / "nube/agencias.json").write_text(json.dumps({"meta": meta, "agencias": AGENCIAS}, ensure_ascii=False, indent=1), encoding="utf-8")
    avisos = [
        {"id": "av-1", "tipo": "EDUCACION", "titulo": "Tu cuota no debería pasar del 40 % de tus ingresos", "texto": "Antes de pedir un crédito, suma tus gastos del mes y usa el simulador para ver una cuota que puedas pagar sin apuros."},
        {"id": "av-2", "tipo": "SEGURIDAD", "titulo": "La cooperativa nunca te pedirá tu clave", "texto": "Ningún asesor te pedirá tu clave por teléfono, WhatsApp o correo. Si alguien lo hace, cuelga y llama a tu agencia."},
        {"id": "av-3", "tipo": "PRIVACIDAD", "titulo": "Tus datos, con tu autorización", "texto": "Solo consultamos el buró y la central de riesgos con tu autorización firmada (LOPDP). Puedes revisarla o revocarla desde tu perfil."},
    ]
    (SIM / "nube/avisos.json").write_text(json.dumps({"meta": meta, "avisos": avisos}, ensure_ascii=False, indent=1), encoding="utf-8")

    demo = socios[0]
    print(f"OK: {len(plan)} solicitudes, {len(creditos)} créditos, {len(socios)} socios.")
    print(f"Socio demo: {demo['nombres']} {demo['ap1']} · usuario {demo['cedula']} · clave {CLAVE_DEMO}")


if __name__ == "__main__":
    main()
