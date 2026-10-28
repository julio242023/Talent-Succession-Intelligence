"""
Utilidad de lectura, normalización y exportación del archivo Excel
2026_Reporte_Sucesion.xlsx (Mapeo de Talento - Talent Pool).
No requiere openpyxl; utiliza zipfile + xml.etree.ElementTree para lectura nativa
y xlsxwriter / SheetJS para escritura.
"""

import os
import json
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Any

NS = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

NINE_BOX_LABELS = {
    1: "1 · Bajo Desempeño / Bajo Potencial",
    2: "2 · Desempeño Medio / Bajo Potencial",
    3: "3 · Alto Desempeño / Bajo Potencial (Experto)",
    4: "4 · Bajo Desempeño / Potencial Medio",
    5: "5 · Talento Clave / Core (Medio / Medio)",
    6: "6 · Alto Desempeño / Potencial Medio",
    7: "7 · Bajo Desempeño / Alto Potencial (Enigma)",
    8: "8 · Alto Potencial / Desempeño Medio (Futuro Líder)",
    9: "9 · Talento Estrella (Alto Desempeño / Alto Potencial)",
}


def col_letters(cell_ref: str) -> str:
    return ''.join(c for c in cell_ref if c.isalpha())


def parse_excel_file(filepath: str) -> List[Dict[str, Any]]:
    """
    Lee el archivo .xlsx (2026_Reporte_Sucesion.xlsx o 2026_Reporte Comité de Talento Desarrollo y Sucesión.xlsx)
    y devuelve la lista estructurada de registros de talento.
    Detecta dinámicamente la fila de cabeceras (Fila 10 en el formato original o Fila 1 en exportaciones planas).
    """
    if not os.path.exists(filepath):
        return []

    with zipfile.ZipFile(filepath, 'r') as z:
        shared_strings: List[str] = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in ss_root.findall('main:si', NS):
                texts = [t.text or '' for t in si.findall('.//main:t', NS)]
                shared_strings.append(''.join(texts))

        # Buscar en todas las hojas aquella que contenga la cabecera "Empresa"
        sheets = sorted([n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')])
        if not sheets:
            return []

        raw_rows: Dict[int, Dict[str, str]] = {}
        header_row_idx = None
        col_map: Dict[str, str] = {}

        for sheet_name in sheets:
            sheet_root = ET.fromstring(z.read(sheet_name))
            candidate_rows: Dict[int, Dict[str, str]] = {}
            for row in sheet_root.findall('.//main:sheetData/main:row', NS):
                r_idx = int(row.attrib.get('r', 0))
                row_dict: Dict[str, str] = {}
                for c in row.findall('main:c', NS):
                    ref = c.attrib.get('r', '')
                    col = col_letters(ref)
                    t = c.attrib.get('t', '')
                    v = c.find('main:v', NS)
                    val = v.text if v is not None else ''
                    if t == 's' and val != '':
                        val = shared_strings[int(val)]
                    elif t == 'inlineStr':
                        is_el = c.find('.//main:t', NS)
                        val = is_el.text if is_el is not None else ''
                    row_dict[col] = (val or '').strip()
                if any(row_dict.values()):
                    candidate_rows[r_idx] = row_dict

            for r_idx in sorted(candidate_rows.keys()):
                r_vals = candidate_rows[r_idx]
                for col, text in r_vals.items():
                    if text.lower() in ('empresa', 'compañía', 'unidad de negocio'):
                        header_row_idx = r_idx
                        col_map = r_vals
                        raw_rows = candidate_rows
                        break
                if header_row_idx is not None:
                    break
            if header_row_idx is not None:
                break

    records: List[Dict[str, Any]] = []
    if header_row_idx is None:
        return records

    # Mapear columnas según nombre de cabecera oficial de 2026_Reporte_Sucesion.xlsx (Hoja: Talent Pool)
    header_by_key: Dict[str, str] = {}
    for col, h_text in col_map.items():
        h_clean = h_text.lower().strip()
        if not h_clean or 'powerappsid' in h_clean:
            continue
        if h_clean in ('empresa', 'compañía', 'unidad de negocio') or 'empresa' in h_clean:
            header_by_key['empresa'] = col
        elif 'documento' in h_clean or 'dni' in h_clean:
            header_by_key['documento'] = col
        elif 'apellido' in h_clean:
            header_by_key['apellidos'] = col
        elif h_clean in ('nombre', 'nombres'):
            header_by_key['nombre'] = col
        elif 'nombre del talento' in h_clean or 'talento' in h_clean:
            header_by_key['nombre_completo'] = col
        elif 'nombre de la posición' in h_clean or 'nombre de la posicion' in h_clean or h_clean in ('posición', 'posicion', 'cargo'):
            header_by_key['posicion'] = col
        elif 'nivel de posición' in h_clean or 'nivel de posicion' in h_clean or 'nivel' in h_clean:
            header_by_key['nivel'] = col
        elif 'ggs' in h_clean:
            header_by_key['ggs'] = col
        elif 'cargo de valor' in h_clean or 'posición crítica' in h_clean or 'posicion critica' in h_clean:
            header_by_key['cargo_valor'] = col
        elif 'tiempo' in h_clean and ('posición' in h_clean or 'posicion' in h_clean):
            header_by_key['tiempo_posicion'] = col
        elif '9box' in h_clean or '9-box' in h_clean or '9 box' in h_clean:
            header_by_key['nine_box'] = col
        elif 'riesgo' in h_clean:
            header_by_key['riesgo'] = col
        elif 'tiene sucesor' in h_clean:
            header_by_key['tiene_sucesor'] = col
        elif 'nombre sucesor' in h_clean or 'nombre del sucesor' in h_clean or h_clean == 'sucesor':
            header_by_key['sucesor'] = col
        elif 'motivación' in h_clean or 'motivacion' in h_clean:
            header_by_key['motivacion_sucesor'] = col
        elif 'readiness' in h_clean or 'preparación' in h_clean or 'preparacion' in h_clean:
            header_by_key['readiness'] = col

    seq = 1
    for r_idx in sorted(raw_rows.keys()):
        if r_idx <= header_row_idx:
            continue
        r = raw_rows[r_idx]
        empresa = r.get(header_by_key.get('empresa', 'B'), '').strip()
        if not empresa:
            continue

        documento = r.get(header_by_key.get('documento', 'D'), '').strip()
        apellidos = r.get(header_by_key.get('apellidos', 'E'), '').strip()
        nombre = r.get(header_by_key.get('nombre', 'F'), '').strip()
        nombre_completo_col = r.get(header_by_key.get('nombre_completo', ''), '').strip()

        if nombre_completo_col and not (nombre or apellidos):
            partes = nombre_completo_col.split(' ', 1)
            nombre = partes[0]
            apellidos = partes[1] if len(partes) > 1 else ''
            nombre_completo = nombre_completo_col
        else:
            nombre_completo = f"{nombre} {apellidos}".strip()

        posicion = r.get(header_by_key.get('posicion', 'G'), '').strip()
        nivel = r.get(header_by_key.get('nivel', 'H'), '').strip()
        if not nivel and '·' in posicion:
            parts = [p.strip() for p in posicion.split('·')]
            posicion = parts[0]
            nivel = parts[1] if len(parts) > 1 else 'N-2'

        ggs_raw = r.get(header_by_key.get('ggs', 'I'), '').strip()
        ggs_num_str = ''.join(ch for ch in ggs_raw if ch.isdigit())
        ggs_num = int(ggs_num_str) if ggs_num_str else 15
        ggs_label = f"GGS {ggs_num}"

        cargo_valor = r.get(header_by_key.get('cargo_valor', 'J'), 'No').strip()
        if cargo_valor.lower() in ('si', 'sí', 'yes', 'true', '1'):
            cargo_valor = 'Sí'
        else:
            cargo_valor = 'No'

        tiempo_posicion = r.get(header_by_key.get('tiempo_posicion', 'K'), '2 años, 0 meses').strip()

        nb_raw = r.get(header_by_key.get('nine_box', 'L'), '5').strip()
        nb_digits = ''.join(ch for ch in nb_raw if ch.isdigit())
        nine_box = int(nb_digits[0]) if nb_digits else 5

        riesgo = r.get(header_by_key.get('riesgo', 'M'), 'Medio').strip().capitalize()
        if riesgo not in ('Alto', 'Medio', 'Bajo'):
            riesgo = 'Medio'

        tiene_sucesor_raw = r.get(header_by_key.get('tiene_sucesor', 'N'), '').strip()
        sucesor_raw = r.get(header_by_key.get('sucesor', 'O'), '').strip()
        motivacion = r.get(header_by_key.get('motivacion_sucesor', 'P'), '').strip()
        readiness_raw = r.get(header_by_key.get('readiness', 'Q'), '').strip()

        if tiene_sucesor_raw.lower() in ('no', 'false', '0') or sucesor_raw.lower() in ('', 'sin sucesor', 'ninguno', 'n/a', '-'):
            tiene_sucesor = 'No'
            tiene_sucesor_bool = False
            sucesor = 'Sin sucesor'
            motivacion = '-'
            readiness = '-'
        else:
            tiene_sucesor = 'Sí'
            tiene_sucesor_bool = True
            sucesor = sucesor_raw
            readiness = readiness_raw if readiness_raw else '1 a 3 años'

        records.append({
            "id": seq,
            "fila_excel": r_idx,
            "empresa": empresa,
            "documento": documento or f"4000{seq:04d}",
            "nombre": nombre_completo,
            "nombre_corto": nombre,
            "apellidos": apellidos,
            "nombre_completo": nombre_completo,
            "posicion": posicion,
            "nivel": nivel or "N-2",
            "posicion_nivel": f"{posicion} ({nivel})" if nivel else posicion,
            "ggs": ggs_num,
            "ggs_label": ggs_label,
            "cargo_valor": cargo_valor,
            "tiempo_posicion": tiempo_posicion,
            "nine_box": nine_box,
            "nine_box_label": NINE_BOX_LABELS.get(nine_box, f"Cuadrante {nine_box}"),
            "riesgo": riesgo,
            "tiene_sucesor": tiene_sucesor,
            "tiene_sucesor_bool": tiene_sucesor_bool,
            "sucesor": sucesor,
            "motivacion_sucesor": motivacion or "-",
            "readiness": readiness,
        })
        seq += 1

    return records


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    xlsx_path = os.path.join(base_dir, "2026_Reporte_Sucesion.xlsx")
    data = parse_excel_file(xlsx_path)
    print(f"Registros extraídos de {xlsx_path}: {len(data)}")
    web_dir = os.path.join(base_dir, "web")
    os.makedirs(web_dir, exist_ok=True)
    initial_data_js_path = os.path.join(web_dir, "initial-data.js")
    with open(initial_data_js_path, "w", encoding="utf-8") as f:
        f.write("// Datos iniciales embebidos de 2026_Reporte_Sucesion.xlsx para modo estático (GitHub Pages)\n")
        f.write("window.CENTRIA_INITIAL_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"Archivo generado exitosamente: {initial_data_js_path}")
