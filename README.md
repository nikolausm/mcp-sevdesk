# mcp-sevdesk

Ein MCP (Model Context Protocol) Server für die sevdesk API. Ermöglicht die Integration von sevdesk-Buchhaltungsfunktionen in Claude und andere MCP-kompatible Anwendungen.

## Features

- **Kontakte**: Erstellen, lesen, aktualisieren und löschen von Kontakten (Kunden, Lieferanten, Partner)
- **Rechnungen**: Auflisten, abrufen, als PDF exportieren, per E-Mail versenden, buchen und stornieren
- **Belege (Voucher)**: Verwalten von Eingangsrechnungen und Ausgaben
- **Bankkonten**: Verwalten von Bankkonten und Transaktionen
- **Artikel**: Verwalten von Produkten und Dienstleistungen

## Installation

```bash
npm install
npm run generate-types
npm run build
```

## Konfiguration

Setze die Umgebungsvariable `SEVDESK_API_TOKEN` mit deinem sevdesk API-Token:

```bash
export SEVDESK_API_TOKEN="dein-32-zeichen-hex-token"
```

Den API-Token findest du in sevdesk unter: Einstellungen → Benutzer → API-Token

## Verwendung

### Als MCP-Server

Füge den Server zu deiner Claude Desktop Konfiguration hinzu (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sevdesk": {
      "command": "node",
      "args": ["/pfad/zu/mcp-sevdesk/dist/index.js"],
      "env": {
        "SEVDESK_API_TOKEN": "dein-api-token"
      }
    }
  }
}
```

### Direkt ausführen

```bash
SEVDESK_API_TOKEN="dein-token" npm start
```

## Verfügbare Tools

### Kontakte

| Tool | Beschreibung |
|------|-------------|
| `list_contacts` | Alle Kontakte auflisten |
| `get_contact` | Einzelnen Kontakt abrufen |
| `create_contact` | Neuen Kontakt erstellen |
| `update_contact` | Kontakt aktualisieren |
| `delete_contact` | Kontakt löschen |

### Rechnungen

| Tool | Beschreibung |
|------|-------------|
| `list_invoices` | Alle Rechnungen auflisten |
| `get_invoice` | Einzelne Rechnung abrufen |
| `get_invoice_pdf` | Rechnung als PDF abrufen |
| `send_invoice_by_email` | Rechnung per E-Mail versenden |
| `mark_invoice_as_sent` | Rechnung als versendet markieren |
| `book_invoice` | Rechnung als bezahlt buchen |
| `cancel_invoice` | Rechnung stornieren |

### Belege (Voucher)

| Tool | Beschreibung |
|------|-------------|
| `list_vouchers` | Alle Belege auflisten |
| `get_voucher` | Einzelnen Beleg abrufen |
| `book_voucher` | Beleg als bezahlt buchen |
| `get_voucher_positions` | Belegpositionen abrufen |
| `upload_voucher_file` | Belegdatei hochladen |

### Bankkonten

| Tool | Beschreibung |
|------|-------------|
| `list_check_accounts` | Alle Bankkonten auflisten |
| `get_check_account` | Einzelnes Bankkonto abrufen |
| `get_check_account_balance` | Kontostand abrufen |
| `list_transactions` | Transaktionen auflisten |
| `get_transaction` | Einzelne Transaktion abrufen |
| `create_transaction` | Neue Transaktion erstellen |

### Artikel

| Tool | Beschreibung |
|------|-------------|
| `list_parts` | Alle Artikel auflisten |
| `get_part` | Einzelnen Artikel abrufen |
| `create_part` | Neuen Artikel erstellen |
| `update_part` | Artikel aktualisieren |
| `get_part_stock` | Lagerbestand abrufen |

## API-Referenz

Dieser Server basiert auf der offiziellen sevdesk API v1. Weitere Informationen zur API findest du in der [sevdesk API-Dokumentation](https://api.sevdesk.de/).

## Offline-Prüfungen

Nach `npm ci --ignore-scripts` und `npm run generate-types` führt `npm run test:offline` Build und MCP-Protokolltests aus. Alle 34 Tools werden mit synthetischem Token und abgefangenem HTTP geprüft, einschließlich Schreibaktionen, ungültigen Eingaben und API-Fehlern. Es werden keine echten Kontakte, Rechnungen oder Buchungen verändert und keine E-Mails versandt.

CI prüft dies unter Node 22 und 24 sowie mit `npm audit --audit-level=moderate`. `npm test` bleibt die bestehende Integrationstestsuite; ihre Tests werden ohne `SEVDESK_API_TOKEN` übersprungen und ersetzen keine Offline-Prüfung.

## Lizenz

MIT
