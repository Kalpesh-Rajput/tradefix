# Zerodha

Verified on: 2026-10-06

Status at audit: UI ONLY. There is still no Kite Connect adapter.

File import detects a CSV whose headers include `symbol`, `trade_date`, `trade_type`, `quantity`, and `price` (Console tradebook shape). Other files stay on the generic preview. Rows are not written until confirm.

Support article (category, not a file schema): https://support.zerodha.com/category/console/reports/tradebook

A real tradebook sample was not available here, so column order beyond those headers is unverified.
