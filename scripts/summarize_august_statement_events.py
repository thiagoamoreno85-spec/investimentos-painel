from pathlib import Path
from collections import defaultdict
import csv
import json

INPUT_PATH = Path('/home/ubuntu/investimentos-painel/.tmp_statement_aug2026_classified.json')
OUTPUT_PATH = Path('/home/ubuntu/investimentos-painel/.tmp_august_statement_reconciliation.json')

payload = json.loads(INPUT_PATH.read_text(encoding='utf-8'))
events = payload['events']

def ticker_from_description(description):
    text = description.upper()
    candidates = (
        ('TTEN', 'TTEN3'),
        ('MBRF', 'MBRF3'),
        ('BBDC', 'BBDC4'),
        ('BPAC', 'BPAC11'),
        ('CXSE', 'CXSE3'),
        ('KLBN', 'KLBN11'),
        ('AURE', 'AURE3'),
        ('VALE', 'VALE3'),
        ('CMIN', 'CMIN3'),
        ('FLRY', 'FLRY3'),
        ('XPML', 'XPML11'),
        ('ZAVI', 'ZAVI11'),
    )
    for needle, ticker in candidates:
        if needle in text:
            return ticker
    if 'CYRE' in text:
        return 'CYRE?'
    return None

classified = {
    'aportes': [],
    'proventos_fii': [],
    'aluguéis': [],
    'reembolsos_corporativos': [],
    'resgates_e_ir': [],
}
rentals_by_ticker = defaultdict(lambda: defaultdict(float))

for event in events:
    category = event['category']
    description = event['description']
    ticker = ticker_from_description(description)
    entry = {**event, 'ticker': ticker}
    if category == 'aporte_conta_digital':
        classified['aportes'].append(entry)
    elif category == 'provento_fii':
        classified['proventos_fii'].append(entry)
    elif category.startswith('aluguel_acoes') or category == 'ajuste_custo_aluguel':
        classified['aluguéis'].append(entry)
        bucket = ticker or 'NAO_IDENTIFICADO'
        rentals_by_ticker[bucket][category] += event['value_brl']
    elif category == 'reembolso_evento_corporativo':
        classified['reembolsos_corporativos'].append(entry)
    elif category in {'resgate_cdb', 'ir_resgate_cdb'}:
        classified['resgates_e_ir'].append(entry)

rental_summary = []
for ticker, amounts in sorted(rentals_by_ticker.items()):
    gross = amounts['aluguel_acoes_bruto']
    intermediary = amounts['aluguel_acoes_intermediacao']
    irrf = amounts['aluguel_acoes_irrf']
    b3_fee = amounts['aluguel_acoes_taxa_b3'] + amounts['aluguel_acoes_emolumentos']
    adjustments = amounts['ajuste_custo_aluguel']
    net = gross + intermediary + irrf + b3_fee + adjustments
    rental_summary.append({
        'ticker': ticker,
        'gross_rent_brl': round(gross, 2),
        'intermediation_brl': round(intermediary, 2),
        'irrf_brl': round(irrf, 2),
        'b3_fees_brl': round(b3_fee, 2),
        'cost_adjustments_brl': round(adjustments, 2),
        'net_cash_effect_brl': round(net, 2),
    })

result = {
    'aportes': classified['aportes'],
    'proventos_fii': classified['proventos_fii'],
    'aluguéis_por_ativo': rental_summary,
    'aluguéis_lancamentos': classified['aluguéis'],
    'reembolsos_corporativos': classified['reembolsos_corporativos'],
    'resgates_e_ir': classified['resgates_e_ir'],
    'totais': {
        'aportes_brutos': round(sum(item['value_brl'] for item in classified['aportes']), 2),
        'proventos_fii': round(sum(item['value_brl'] for item in classified['proventos_fii']), 2),
        'aluguéis_efeito_caixa': round(sum(item['net_cash_effect_brl'] for item in rental_summary), 2),
        'aluguéis_brutos': round(sum(item['gross_rent_brl'] for item in rental_summary), 2),
        'reembolsos_corporativos': round(sum(item['value_brl'] for item in classified['reembolsos_corporativos']), 2),
    },
}

OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'totais': result['totais'], 'aluguéis_por_ativo': rental_summary}, ensure_ascii=False, indent=2))
print(f'Output: {OUTPUT_PATH}')
