from pathlib import Path
from datetime import datetime, date
from collections import defaultdict
import csv
import json
import openpyxl

STATEMENT_PATH = Path('/home/ubuntu/upload/Extrato496056AGO.2026.xlsx')
JSON_OUTPUT_PATH = Path('/home/ubuntu/investimentos-painel/.tmp_statement_aug2026_classified.json')
CSV_OUTPUT_PATH = Path('/home/ubuntu/investimentos-painel/.tmp_statement_aug2026_classified.csv')

def iso(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value) if value is not None else None

def classify(description, value):
    text = description.upper()
    if 'TRANSFERÊNCIA RECEBIDA DA CONTA DIGITAL' in text:
        return 'aporte_conta_digital'
    if 'CRÉDITO REF. TAXA DE REMUNERAÇÃO BTC' in text:
        return 'aluguel_acoes_bruto'
    if 'TAXA DE INTERMEDIAÇÃO DOADOR' in text:
        return 'aluguel_acoes_intermediacao'
    if 'IRRF S/ RENDIMENTO DE BTC' in text:
        return 'aluguel_acoes_irrf'
    if 'DEBITO REF.TAXA DE REMUNERAÇÃO-BTC' in text:
        return 'aluguel_acoes_taxa_b3'
    if 'EMOLUMENTOS BTC' in text:
        return 'aluguel_acoes_emolumentos'
    if 'RENDIMENTOS DE CLIENTES' in text:
        return 'provento_fii'
    if 'JUROS' in text or 'RENDIMENTO' in text:
        return 'provento_ou_juros'
    if 'CREDITO DE REEMBOLSO DE EVENTO' in text:
        return 'reembolso_evento_corporativo'
    if 'AJUSTE DE CUSTOS BTC' in text:
        return 'ajuste_custo_aluguel'
    if 'VENCIMENTO CDB' in text:
        return 'resgate_cdb'
    if 'IR - VENCIMENTO CDB' in text:
        return 'ir_resgate_cdb'
    return 'outro'

workbook = openpyxl.load_workbook(STATEMENT_PATH, read_only=True, data_only=True)
worksheet = workbook.active

events = []
for row_number, row in enumerate(worksheet.iter_rows(min_row=15, values_only=True), start=15):
    movement_date = row[1] if len(row) > 1 else None
    settlement_date = row[2] if len(row) > 2 else None
    description = row[3] if len(row) > 3 else None
    value = row[5] if len(row) > 5 else None
    balance = row[6] if len(row) > 6 else None
    if not description or not isinstance(value, (int, float)):
        continue
    category = classify(str(description), float(value))
    events.append({
        'row': row_number,
        'movement_date': iso(movement_date),
        'settlement_date': iso(settlement_date),
        'description': str(description).strip(),
        'value_brl': round(float(value), 2),
        'balance_brl': round(float(balance), 2) if isinstance(balance, (int, float)) else None,
        'category': category,
    })

workbook.close()

summary = defaultdict(lambda: {'count': 0, 'total_brl': 0.0})
for event in events:
    summary[event['category']]['count'] += 1
    summary[event['category']]['total_brl'] += event['value_brl']

payload = {
    'statement_period': '2026-08-01 to 2026-08-31',
    'events': events,
    'summary_by_category': {
        category: {'count': item['count'], 'total_brl': round(item['total_brl'], 2)}
        for category, item in sorted(summary.items())
    },
}
JSON_OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

with CSV_OUTPUT_PATH.open('w', newline='', encoding='utf-8-sig') as csv_file:
    writer = csv.DictWriter(csv_file, fieldnames=['row', 'movement_date', 'settlement_date', 'description', 'value_brl', 'balance_brl', 'category'])
    writer.writeheader()
    writer.writerows(events)

print(json.dumps(payload['summary_by_category'], ensure_ascii=False, indent=2))
print(f'JSON: {JSON_OUTPUT_PATH}')
print(f'CSV: {CSV_OUTPUT_PATH}')
