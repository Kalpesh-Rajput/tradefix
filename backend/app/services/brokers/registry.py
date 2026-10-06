"""Single provider registry. The frontend must render from this payload."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.brokers.limits import limit_for

VERIFIED_ON = "2026-10-06"


@dataclass(frozen=True)
class ProviderField:
    key: str
    label: str
    required: bool = True
    secret: bool = False
    help: str = ""
    placeholder: str = ""
    options: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    name: str
    display_name: str
    category: str
    aliases: tuple[str, ...]
    description: str
    auth_type: str
    methods: tuple[str, ...]
    capabilities: dict[str, str]
    fields: tuple[ProviderField, ...]
    badges: tuple[str, ...]
    instructions: dict[str, list[str]]
    limitations: tuple[str, ...]
    docs_url: str
    regions: tuple[str, ...] = ()
    environments: tuple[str, ...] = ()
    popular: bool = False
    file_formats: tuple[str, ...] = ()

    def public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "category": self.category,
            "aliases": list(self.aliases),
            "description": self.description,
            "auth_type": self.auth_type,
            "methods": list(self.methods),
            "capabilities": dict(self.capabilities),
            "badges": list(self.badges),
            "fields": [
                {
                    "key": item.key,
                    "label": item.label,
                    "required": item.required,
                    "secret": item.secret,
                    "help": item.help,
                    "placeholder": item.placeholder,
                    "options": list(item.options),
                    "type": "select" if item.options else "password" if item.secret else "text",
                }
                for item in self.fields
            ],
            "instructions": {key: list(value) for key, value in self.instructions.items()},
            "limitations": list(self.limitations),
            "docs_url": self.docs_url,
            "regions": list(self.regions),
            "environments": list(self.environments),
            "popular": self.popular,
            "file_formats": list(self.file_formats),
            "parser_id": self.file_formats[0] if self.file_formats else None,
            "logo": None,
            "limits": limit_for(self.id).public(),
            "capability_flags": _capability_flags(self),
            "verified_on": VERIFIED_ON,
        }


def _capability_flags(spec: ProviderSpec) -> dict[str, bool]:
    caps = spec.capabilities
    return {
        "historical_trades": caps.get("historical_trades") == "yes",
        "realtime": False,
        "positions": caps.get("positions") == "yes",
        "orders": caps.get("orders") == "yes",
        "balances": caps.get("balances") == "yes",
        "oauth": spec.auth_type == "oauth",
        "terminal_bridge": caps.get("mt_bridge") == "yes",
        "file_import": "file_import" in spec.methods,
    }


def _mt_fields(server_help: str) -> tuple[ProviderField, ...]:
    return (
        ProviderField(
            "platform",
            "Platform",
            options=("mt5", "mt4"),
            help="Choose the terminal you log in to. MetaTrader 4 and MetaTrader 5 are different programs.",
        ),
        ProviderField("timezone", "Time zone", required=False, help="Display only. TradeFix stores timestamps in UTC."),
        ProviderField(
            "login",
            "Login",
            placeholder="MT account number",
            help="Your MetaTrader account number, shown on the login screen.",
        ),
        ProviderField(
            "password",
            "Investor password",
            secret=True,
            help="Use the investor (read-only) password from your broker. It cannot place trades or withdraw funds.",
        ),
        ProviderField("server", "Server", help=server_help, placeholder="Exact server name"),
        ProviderField("history_preset", "Date range", options=("7d", "30d", "90d", "180d", "365d", "custom")),
    )


_MT_CAPS = {
    "historical_trades": "yes",
    "incremental": "yes",
    "realtime": "bridge_dependent",
    "websocket": "not_supported",
    "polling": "yes",
    "account_discovery": "single_login",
    "positions": "not_implemented",
    "orders": "not_implemented",
    "executions": "yes",
    "balances": "yes",
    "oauth": "no",
    "passphrase": "no",
    "mt_bridge": "yes",
    "file_import": "html",
    "permission_check": "investor_password_is_read_only",
}


def _caps(**overrides: str) -> dict[str, str]:
    base = {
        "historical_trades": "yes",
        "incremental": "yes",
        "realtime": "incremental_rest_and_reconciliation",
        "websocket": "not_running",
        "polling": "yes",
        "account_discovery": "single_key",
        "positions": "not_implemented",
        "orders": "not_implemented",
        "executions": "yes",
        "balances": "yes",
        "oauth": "no",
        "passphrase": "no",
        "mt_bridge": "no",
        "file_import": "csv",
        "permission_check": "when_provider_exposes_it",
    }
    base.update(overrides)
    return base


_DATE = ProviderField("history_preset", "Date range", options=("7d", "30d", "90d", "180d", "365d", "custom"))


PROVIDERS: tuple[ProviderSpec, ...] = (
    ProviderSpec(
        id="mt5",
        name="MetaTrader 5",
        display_name="MetaTrader 5",
        category="platform",
        aliases=("mt5", "metatrader", "metatrader 5"),
        description="Enter the account number, investor password, and server from MetaTrader 5. TradeFix imports your history and does not place trades.",
        auth_type="mt_credentials",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_MT_CAPS,
        fields=_mt_fields("Copy the server name from MetaTrader 5 → File → Login to Trade Account. It must match exactly."),
        badges=("Terminal", "Read Only", "File Import"),
        instructions={
            "what_you_need": ["MT5 login", "Investor (read-only) password", "Server name"],
            "steps": [
                "Open MetaTrader 5 and go to File → Login to Trade Account.",
                "Copy the account number and the server name, including the broker suffix.",
                "In your broker’s client area, copy the investor password. Do not use the master trading password.",
                "Paste those three values here and choose how far back to import.",
            ],
            "permissions": ["Investor password is read-only. TradeFix does not place orders."],
            "security": ["The password is encrypted on the TradeFix server. It is not stored in the browser."],
            "what_we_sync": ["Account balance and equity when the bridge returns them", "Closed and open trades as executions"],
            "limitations": [
                "One MT5 terminal session holds one login. Concurrent accounts need separate bridge processes.",
                "The bridge URL must be set on the server. If it is missing, connect fails instead of showing Connected.",
            ],
            "troubleshooting": ["Server name must match the terminal exactly, including the broker suffix."],
        },
        limitations=("Requires TRADEFIX_MT_BRIDGE_URL. Direct cloud API is not used.",),
        docs_url="https://www.mql5.com/en/docs/python_metatrader5",
        environments=("live", "demo"),
        popular=True,
        file_formats=("mt5-html",),
    ),
    ProviderSpec(
        id="mt4",
        name="MetaTrader 4",
        display_name="MetaTrader 4",
        category="platform",
        aliases=("mt4", "metatrader 4"),
        description="Enter the account number, investor password, and server from MetaTrader 4. Use the investor password, not the master password.",
        auth_type="mt_credentials",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_MT_CAPS,
        fields=_mt_fields("Copy the server name from MetaTrader 4 → File → Login. It must match exactly."),
        badges=("Terminal", "Read Only", "File Import"),
        instructions={
            "what_you_need": ["MT4 login", "Investor password", "Server name"],
            "steps": [
                "Open MetaTrader 4 and go to File → Login.",
                "Copy the account number and the exact server name.",
                "Use the investor password from your broker’s client area, then choose a date range.",
            ],
            "permissions": ["Read-only investor password. No order placement."],
            "security": ["Credentials stay on the server, encrypted."],
            "what_we_sync": ["Account summary", "Closed trades", "Open positions when the bridge returns them"],
            "limitations": ["If the bridge process only speaks MT5, MT4 connect returns a real error from the bridge."],
            "troubleshooting": ["A failed connect means the bridge rejected the login. TradeFix does not invent a session."],
        },
        limitations=("Bridge-dependent. MetaApi is not used.",),
        docs_url="https://www.metatrader4.com/",
        environments=("live", "demo"),
        popular=True,
        file_formats=("mt4-html",),
    ),
    ProviderSpec(
        id="xm",
        name="XM",
        display_name="XM",
        category="forex",
        aliases=("xm", "xm global", "trading point"),
        description="XM uses MetaTrader. Copy the MT login, investor password, and server from the Members Area. Do not enter your XM website password.",
        auth_type="mt_credentials",
        methods=("broker_sync", "file_import", "manual"),
        capabilities={**_MT_CAPS, "direct_api": "not_verified"},
        fields=_mt_fields("Copy the server from the trading-account card in the XM Members Area."),
        badges=("Terminal", "Read Only"),
        instructions={
            "what_you_need": ["MT4 or MT5 login", "Investor password", "Server"],
            "steps": [
                "Log in to the XM Members Area and open the MetaTrader trading account.",
                "Copy the MT account number and the server name.",
                "Copy the investor password if XM shows one. Leave the website password out.",
                "Choose MT4 or MT5 to match that account, then connect.",
            ],
            "permissions": ["Read-only MT investor access."],
            "security": ["No XM web password is collected."],
            "what_we_sync": ["Whatever the MT bridge returns for that login: deals, orders, positions, balance."],
            "limitations": [
                "No XM-specific REST API was verified for retail trade sync on 2026-10-06.",
                "Server presets are not shipped. Type the server from your Members Area.",
            ],
            "troubleshooting": ["If the server is wrong, the bridge returns server not found. Credentials are not kept on that failure."],
        },
        limitations=("MT4/MT5 route only. Direct XM API is unverified.",),
        docs_url="https://www.xm.com/",
        popular=True,
        file_formats=("mt4-html", "mt5-html"),
    ),
    ProviderSpec(
        id="exness",
        name="Exness",
        display_name="Exness",
        category="forex",
        aliases=("exness",),
        description="Connect an Exness MetaTrader account with the MT login, investor password, and server from the Personal Area. Standard accounts do not use an Exness API key.",
        auth_type="mt_credentials",
        methods=("broker_sync", "file_import", "manual"),
        capabilities={**_MT_CAPS, "direct_api": "not_verified"},
        fields=_mt_fields("Copy the server shown on the Exness MetaTrader login screen."),
        badges=("Terminal", "Read Only"),
        instructions={
            "what_you_need": ["MT login", "Investor password", "Server"],
            "steps": [
                "In the Exness Personal Area, open the trading account and note the MetaTrader server.",
                "Copy the account number and the investor password.",
                "Choose MT4 or MT5 to match that account and connect. Do not use your Exness website password.",
            ],
            "permissions": ["Read-only investor password."],
            "security": ["The Exness Public Trader API exists, but it is limited to Vietnam and Thailand and does not accept standard MetaTrader accounts. TradeFix does not ask for an Exness API key."],
            "what_we_sync": ["MT deals, orders, positions, and account summary."],
            "limitations": ["Region or account blocks are returned by the bridge as authentication errors, not hidden."],
            "troubleshooting": ["Check login, server, and investor password. A failed attempt does not save the password."],
        },
        limitations=(
            "MetaTrader is the path for standard accounts. The Exness Public Trader API (https://www.exness-api.com/) returns order history only for Exness Terminal accounts in Vietnam and Thailand. Verified 2026-10-06. That connector is not built.",
        ),
        docs_url="https://www.exness.com/",
        popular=True,
        file_formats=("mt4-html", "mt5-html"),
    ),
    ProviderSpec(
        id="avatrade",
        name="AvaTrade",
        display_name="AvaTrade",
        category="forex",
        aliases=("avatrade", "ava"),
        description="Connect AvaTrade through MetaTrader using the login, investor password, and server on your account. Or upload an MT4 or MT5 statement on File Import.",
        auth_type="mt_credentials",
        methods=("broker_sync", "file_import", "manual"),
        capabilities={**_MT_CAPS, "direct_api": "not_verified"},
        fields=_mt_fields("Copy the server from your AvaTrade MT4 or MT5 account details."),
        badges=("Terminal", "File Import"),
        instructions={
            "what_you_need": ["MT4 or MT5 login", "Investor password", "Server"],
            "steps": [
                "Open your AvaTrade account and copy the MetaTrader server and account number.",
                "Use the investor password, not your AvaTrade website password.",
                "If you cannot use the terminal, export an MT4 or MT5 statement and upload it on File Import.",
            ],
            "permissions": ["Read-only."],
            "security": ["No AvaTrade web password is requested."],
            "what_we_sync": ["MT history via the bridge, or rows from a verified statement file."],
            "limitations": ["A public AvaTrade retail REST API was not verified on 2026-10-06. AvaTradeGO export format is unverified, so it is not listed as a parser."],
            "troubleshooting": ["Use File Import with an MT4 or MT5 statement if the bridge is not configured."],
        },
        limitations=("No verified direct API. AvaTradeGO export parser is not shipped.",),
        docs_url="https://www.avatrade.com/",
        file_formats=("mt4-html", "mt5-html"),
    ),
    ProviderSpec(
        id="ctrader",
        name="cTrader",
        display_name="cTrader",
        category="platform",
        aliases=("ctrader", "spotware"),
        description="Sign in on cTrader’s own page. TradeFix never asks for your cTrader password. Choose demo or live, then approve access.",
        auth_type="oauth",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_caps(
            account_discovery="yes",
            oauth="yes",
            realtime="json_session_on_port_5036",
            websocket="request_response_not_a_standing_stream",
            permission_check="oauth_scope",
            file_import="csv",
        ),
        fields=(
            _DATE,
            ProviderField("environment", "Environment", options=("demo", "live"), help="Demo and live are separate. Pick the one that matches the account you want to import."),
        ),
        badges=("OAuth", "Auto Sync", "Read Only"),
        instructions={
            "what_you_need": ["A cTrader ID", "The TradeFix Open API app (client id is configured on the server)"],
            "steps": [
                "Choose demo or live.",
                "Click Continue with cTrader. You sign in on cTrader, not inside TradeFix.",
                "Approve access. TradeFix then imports the accounts linked to that sign-in.",
            ],
            "permissions": ["OAuth scope is view-oriented. TradeFix does not send your cTrader password."],
            "security": ["Access and refresh tokens are encrypted. They are not stored in the browser."],
            "what_we_sync": ["Accounts linked to the token", "Deals", "Orders", "Open positions", "Execution events"],
            "limitations": [
                "Requires CTRADER_CLIENT_ID, CTRADER_CLIENT_SECRET, and CTRADER_REDIRECT_URI on the server.",
                "History and realtime use the official JSON Open API on port 5036.",
            ],
            "troubleshooting": ["If the app is not registered, authorize returns a configuration error."],
        },
        limitations=("Server must hold the Spotware Open API app credentials.",),
        docs_url="https://help.ctrader.com/open-api/",
        environments=("demo", "live"),
        popular=True,
        file_formats=("csv",),
    ),
    ProviderSpec(
        id="xtb",
        name="XTB",
        display_name="XTB",
        category="forex",
        aliases=("xtb", "xstation"),
        description="XTB ended public API access on 14 March 2025. Export your history from xStation and upload the file on File Import.",
        auth_type="file_only",
        methods=("file_import", "manual"),
        capabilities={
            "historical_trades": "not_supported",
            "incremental": "not_supported",
            "realtime": "not_supported",
            "websocket": "not_supported",
            "polling": "not_supported",
            "account_discovery": "not_supported",
            "positions": "not_supported",
            "orders": "not_supported",
            "executions": "not_supported",
            "balances": "not_supported",
            "oauth": "no",
            "passphrase": "no",
            "mt_bridge": "no",
            "file_import": "csv",
            "permission_check": "not_supported",
            "direct_api": "discontinued_2025_03_14",
        },
        fields=(),
        badges=("File Import",),
        instructions={
            "what_you_need": ["An XTB history export (CSV or XLSX)"],
            "steps": [
                "XTB no longer offers a public API, so Broker Sync is not shown.",
                "In xStation, export your account history as CSV or XLSX.",
                "Upload that file on File Import and confirm the preview before anything is saved.",
            ],
            "permissions": ["No XTB credentials are requested."],
            "security": ["There is no API key to store."],
            "what_we_sync": ["Rows from the file you upload, after you confirm the preview."],
            "limitations": ["A parser runs only when the file headers match a tested XTB export shape. Unknown files are shown for manual mapping, not discarded."],
            "troubleshooting": ["If columns are not recognized, map them in the preview. Nothing is imported until you confirm."],
        },
        limitations=("Public xAPI discontinued 2025-03-14. https://www.xtb.com/en/help-center/our-platforms-6/does-xtb-offer-investment-automation-tools",),
        docs_url="https://www.xtb.com/en/help-center/our-platforms-6/does-xtb-offer-investment-automation-tools",
        popular=True,
        file_formats=("csv", "xlsx"),
    ),
    ProviderSpec(
        id="binance",
        name="Binance",
        display_name="Binance",
        category="crypto",
        aliases=("binance", "crypto"),
        description="Create a Binance API key with Enable Reading only, then paste the key and secret here. Leave withdrawals turned off.",
        auth_type="api_key",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_caps(
            file_import="csv",
            permission_check="yes",
            websocket="subscribe_signature_helper_only",
        ),
        fields=(
            ProviderField("api_key", "API key", help="From Binance → Profile → Account → API Management. Create a system-generated key."),
            ProviderField("api_secret", "API secret", secret=True, help="Shown once when you create the key. Binance will not show it again."),
            ProviderField("market", "Market", options=("spot", "usdt_m", "coin_m"), help="Spot, USD-M futures, or COIN-M futures. Import one market at a time."),
            ProviderField("environment", "Environment", options=("live", "testnet"), help="Use testnet only with a key created on the Binance testnet."),
            _DATE,
        ),
        badges=("Auto Sync", "Read Only", "API"),
        instructions={
            "what_you_need": ["A Binance API key and secret with reading enabled"],
            "steps": [
                "Log in to Binance and open Profile → Account → API Management.",
                "Create an API key and enable Reading only. Do not enable withdrawals.",
                "Paste the key and secret here, then choose spot, USD-M, or COIN-M.",
            ],
            "permissions": ["Read is required. Withdrawals are blocked. Trading permission shows a warning."],
            "security": ["The secret is encrypted at rest and never returned by the API."],
            "what_we_sync": ["Balances", "Trades and futures executions", "Positions where the product exposes them"],
            "limitations": [
                "Spot myTrades is symbol-scoped. Symbols come from non-zero balances and futures position risk, not from a guessed list.",
                "User data uses userDataStream.subscribe.signature. listenKey was removed on 2026-02-20.",
            ],
            "troubleshooting": ["If no symbols can be discovered, sync stops with a historical-limit error instead of reporting a fake empty account."],
        },
        limitations=("Spot history needs discovered symbols. Withdrawal-enabled keys are rejected.",),
        docs_url="https://developers.binance.com/docs/binance-spot-api-docs",
        environments=("live", "testnet"),
        popular=True,
        file_formats=("csv",),
    ),
    ProviderSpec(
        id="bybit",
        name="Bybit",
        display_name="Bybit",
        category="crypto",
        aliases=("bybit",),
        description="Create a Bybit API key on the website and set it to Read-Only. Paste the key and secret, then choose spot, linear, or inverse.",
        auth_type="api_key",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_caps(),
        fields=(
            ProviderField("api_key", "API key", help="Created on the Bybit website under Profile → API. The app cannot create keys."),
            ProviderField("api_secret", "API secret", secret=True, help="Shown once when you create the key. Store it before you leave the page."),
            ProviderField("category", "Category", options=("spot", "linear", "inverse"), help="Spot, USDT linear futures, or inverse futures. Import one category at a time."),
            ProviderField("environment", "Environment", options=("live", "testnet"), help="A testnet key only works when Environment is testnet."),
            _DATE,
        ),
        badges=("Auto Sync", "Read Only", "API"),
        instructions={
            "what_you_need": ["Bybit V5 read-only API key and secret"],
            "steps": [
                "On bybit.com, open the profile menu and go to API. Keys cannot be created in the app.",
                "Create a key and set the permission to Read-Only. Do not enable withdrawals.",
                "Paste the key and secret here and choose spot, linear, or inverse.",
            ],
            "permissions": ["Read-only. Withdrawal-enabled keys are rejected when the key-info endpoint says so."],
            "security": ["Secret encrypted at rest."],
            "what_we_sync": ["Executions", "Closed P&L", "Positions", "Wallet balance"],
            "limitations": ["History calls are split into 7-day windows, which is the V5 execution-list limit."],
            "troubleshooting": ["Regional host issues surface as API unavailable, not as an empty journal."],
        },
        limitations=("7-day request windows. Options are not imported.",),
        docs_url="https://bybit-exchange.github.io/docs/v5/intro",
        environments=("live", "testnet"),
        popular=True,
        file_formats=("csv",),
    ),
    ProviderSpec(
        id="bitget",
        name="Bitget",
        display_name="Bitget",
        category="crypto",
        aliases=("bitget",),
        description="Create a Bitget API key with Read-Only permission. You need the API key, the secret, and the passphrase you chose. Bitget cannot recover a forgotten passphrase.",
        auth_type="api_key_passphrase",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_caps(passphrase="yes"),
        fields=(
            ProviderField("api_key", "API key", help="From Bitget → profile menu → API → Create API. Use a system-generated (HMAC) key."),
            ProviderField("api_secret", "API secret", secret=True, help="Shown once when the key is created. Bitget will not show it again."),
            ProviderField("passphrase", "Passphrase", secret=True, help="The password you set while creating the key. It cannot be recovered. Create a new key if you lose it."),
            ProviderField(
                "product_type",
                "Product",
                options=("spot", "usdt-futures", "coin-futures", "usdc-futures"),
                help="Spot, or the futures wallet you trade. Import one product at a time.",
            ),
            _DATE,
        ),
        badges=("Auto Sync", "API"),
        instructions={
            "what_you_need": ["API key", "Secret", "Passphrase"],
            "steps": [
                "Log in on the Bitget website and open the profile menu → API.",
                "Create an API key, set a passphrase, and choose Read-Only. Leave Trade, Transfer, and Withdraw off.",
                "Copy the API key and secret immediately, then paste all three values here.",
            ],
            "permissions": ["Read-only recommended. Bitget does not always expose a permission bitmap; that limit is shown on the connection."],
            "security": ["Passphrase and secret are encrypted."],
            "what_we_sync": ["Fills", "Orders", "Positions for futures products", "Account assets"],
            "limitations": ["History is requested in provider-sized windows and pages. V1 signing is not used."],
            "troubleshooting": ["A bad passphrase returns invalid credentials and is not retried."],
        },
        limitations=("Permission bitmap is not always available from Bitget.",),
        docs_url="https://www.bitget.com/api-doc/common/intro",
        popular=True,
        file_formats=("csv",),
    ),
    ProviderSpec(
        id="okx",
        name="OKX",
        display_name="OKX",
        category="crypto",
        aliases=("okx", "okex"),
        description="Create an OKX API key with Read permission. You need the API key, secret, and passphrase. A demo key must be created inside Demo Trading.",
        auth_type="api_key_passphrase",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_caps(passphrase="yes"),
        fields=(
            ProviderField("api_key", "API key", help="From OKX → Profile → API → Create API key."),
            ProviderField("api_secret", "Secret key", secret=True, help="Shown once when you create the key."),
            ProviderField("passphrase", "Passphrase", secret=True, help="The passphrase you typed while creating the key. OKX cannot recover it."),
            ProviderField("instrument_type", "Instrument", options=("SPOT", "MARGIN", "SWAP", "FUTURES"), help="Spot, margin, swap, or futures. Import one type at a time."),
            ProviderField("environment", "Environment", options=("live", "demo"), help="Demo only works with a key created under Trade → Demo Trading."),
            _DATE,
        ),
        badges=("Auto Sync", "API"),
        instructions={
            "what_you_need": ["API key", "Secret", "Passphrase"],
            "steps": [
                "Log in to OKX and open Profile → API → Create API key.",
                "Set the permission to Read and create a passphrase you can remember.",
                "For a practice account, create the key inside Trade → Demo Trading and set Environment to demo here.",
            ],
            "permissions": ["Read-only. Withdrawal permission blocks the connection when OKX returns it on the key."],
            "security": ["Secrets encrypted. Orders are not treated as fills."],
            "what_we_sync": ["Fills", "Orders (stored separately)", "Positions and position history", "Account balance"],
            "limitations": ["Options are not imported in this version.", "A fill is not automatically one journal trade; trades are built from position history or FIFO for spot."],
            "troubleshooting": ["Demo keys only work with environment set to demo."],
        },
        limitations=("Options not represented. Orders stay separate from fills.",),
        docs_url="https://www.okx.com/docs-v5/en/",
        environments=("live", "demo"),
        popular=True,
        file_formats=("csv",),
    ),
    ProviderSpec(
        id="delta",
        name="Delta Exchange",
        display_name="Delta Exchange",
        category="crypto",
        aliases=("delta", "delta exchange"),
        description="Create a Delta API key with Read Data. An India key only works with India, and a Global key only works with Global.",
        auth_type="api_key",
        methods=("broker_sync", "file_import", "manual"),
        capabilities=_caps(file_import="csv", realtime="when_documented"),
        fields=(
            ProviderField("api_key", "API key", help="From Delta → Account → Manage API Keys. Enable Read Data."),
            ProviderField("api_secret", "API secret", secret=True, help="Shown once when you create the key. Copy it before you close the page."),
            ProviderField("region", "Region", options=("india", "global"), help="India keys only work on India. Global keys only work on Global. They are not interchangeable."),
            ProviderField("environment", "Environment", options=("live", "testnet"), help="A testnet key only works when Environment is testnet."),
            _DATE,
        ),
        badges=("Auto Sync", "API"),
        instructions={
            "what_you_need": ["API key and secret for the region you select"],
            "steps": [
                "Open Account → Manage API Keys and create a key with Read Data only.",
                "Choose India or Global to match the site where you created the key.",
                "If the key has an IP allowlist, add the egress IP shown on this form.",
            ],
            "permissions": ["Read-only key. TradeFix does not place orders."],
            "security": ["Secret encrypted. The egress IP is never invented."],
            "what_we_sync": ["Wallet", "Fills", "Orders", "Positions"],
            "limitations": ["Fills history is cursor-paged. Page size follows the current Delta limit (50)."],
            "troubleshooting": ["A 401 is invalid credentials or a bad signature, not an empty account."],
        },
        limitations=("Category is crypto derivatives, not forex. IP allowlist uses BROKER_EGRESS_IP.",),
        docs_url="https://docs.delta.exchange/",
        regions=("india", "global"),
        environments=("live", "testnet"),
        popular=True,
        file_formats=("csv",),
    ),
    ProviderSpec(
        id="zerodha",
        name="Zerodha",
        display_name="Zerodha",
        category="stocks",
        aliases=("zerodha", "kite"),
        description="Download your tradebook from Zerodha Console → Reports → Tradebook, then upload the CSV on File Import. No Kite password is required.",
        auth_type="file_only",
        methods=("file_import", "manual"),
        capabilities={
            "historical_trades": "not_supported",
            "incremental": "not_supported",
            "realtime": "not_supported",
            "websocket": "not_supported",
            "polling": "not_supported",
            "account_discovery": "not_supported",
            "positions": "not_supported",
            "orders": "not_supported",
            "executions": "file",
            "balances": "not_supported",
            "oauth": "no",
            "passphrase": "no",
            "mt_bridge": "no",
            "file_import": "zerodha_tradebook_csv",
            "permission_check": "not_supported",
            "direct_api": "not_implemented",
        },
        fields=(),
        badges=("File Import",),
        instructions={
            "what_you_need": ["A Zerodha Console tradebook CSV"],
            "steps": [
                "Log in to Zerodha Console.",
                "Open Reports → Tradebook and download the CSV.",
                "Upload that file on File Import and confirm the preview. Nothing is saved until you confirm.",
            ],
            "permissions": ["No Zerodha password is requested."],
            "security": ["Kite Connect is not connected. This is file import only."],
            "what_we_sync": ["Rows in the tradebook file, after preview."],
            "limitations": ["There is no Zerodha API adapter. The previous UI only listed the name."],
            "troubleshooting": ["Unrecognised columns stay in the preview until you map or skip them."],
        },
        limitations=("File import only. Not a live broker connection.",),
        docs_url="https://support.zerodha.com/category/console/reports/tradebook",
        popular=True,
        file_formats=("zerodha-tradebook-csv",),
    ),
)


_BY_ID = {item.id: item for item in PROVIDERS}


def list_providers() -> list[dict]:
    return [item.public() for item in PROVIDERS]


def get_provider(provider_id: str) -> ProviderSpec:
    from app.services.brokers.errors import BrokerError

    spec = _BY_ID.get(provider_id.strip().lower())
    if spec is None:
        raise BrokerError("NOT_SUPPORTED", "That broker is not in the TradeFix registry.")
    return spec


def provider_allows(provider_id: str, method: str) -> bool:
    return method in get_provider(provider_id).methods
