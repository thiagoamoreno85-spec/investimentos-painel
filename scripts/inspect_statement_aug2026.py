from pathlib import Path
import json
import openpyxl

statement_path = Path('/home/ubuntu/upload/Extrato496056AGO.2026.xlsx')
output_path = Path('/home/ubuntu/investimentos-painel/.tmp_statement_aug2026.json')
workbook = openpyxl.load_workbook(statement_path, read_only=True, data_only=True)
worksheet = workbook.active

rows = []
for row_number, row in enumerate(worksheet.iter_rows(values_only=True), start=1):
    values = [value.isoformat() if hasattr(value, 'isoformat') else value for value in row]
    if any(value is not None for value in values):
        rows.append({'row': row_number, 'values': values})

workbook.close()
output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
print(f'Rows extracted: {len(rows)}')
print(f'Output: {output_path}')
