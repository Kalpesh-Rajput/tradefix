from app.services.brokers.errors import BrokerError
from app.services.brokers.providers.binance import BinanceConnector
from app.services.brokers.providers.bitget import BitgetConnector
from app.services.brokers.providers.bybit import BybitConnector
from app.services.brokers.providers.ctrader import CTraderConnector
from app.services.brokers.providers.delta import DeltaConnector
from app.services.brokers.providers.mt_bridge import MtBridgeConnector
from app.services.brokers.providers.okx import OkxConnector

_MT = {"mt5", "mt4", "xm", "exness", "avatrade"}


def connector_for(provider_id: str):
    provider = provider_id.lower()
    if provider in _MT:
        return MtBridgeConnector(provider)
    if provider == "ctrader":
        return CTraderConnector()
    if provider == "binance":
        return BinanceConnector()
    if provider == "bybit":
        return BybitConnector()
    if provider == "bitget":
        return BitgetConnector()
    if provider == "okx":
        return OkxConnector()
    if provider == "delta":
        return DeltaConnector()
    raise BrokerError("NOT_SUPPORTED", "This provider has no broker sync. Use file import or add the trade manually.")
