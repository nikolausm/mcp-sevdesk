# mcp-sevdesk

Ein MCP (Model Context Protocol) Server für die sevdesk API. Ermöglicht die Integration von sevdesk-Buchhaltungsfunktionen in Claude und andere MCP-kompatible Anwendungen.

## Features

- **Kontakte**: Erstellen, lesen, aktualisieren und löschen von Kontakten (Kunden, Lieferanten, Partner)
- **Adressen**: Anlegen, lesen, aktualisieren und löschen von Kontaktadressen (Rechnungs-, Liefer-, Abholanschrift)
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

### Adressen

| Tool | Beschreibung |
|------|-------------|
| `list_contact_addresses` | Adressen auflisten (optional gefiltert nach `contactId`) |
| `get_contact_address` | Einzelne Adresse abrufen |
| `create_contact_address` | Neue Adresse zu einem Kontakt anlegen |
| `update_contact_address` | Adresse aktualisieren (nur übergebene Felder) |
| `delete_contact_address` | Adresse löschen |
| `list_countries` | Länder auflisten (liefert `countryId`) |
| `list_address_categories` | Adress-Kategorien auflisten (liefert `categoryId`) |

Beim Anlegen einer Adresse sind `contactId`, `countryId` und `categoryId` Pflicht.
Gängige Kategorien: `47` = Rechnungsanschrift, `48` = Lieferanschrift, `49` = Abholanschrift.

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
| `create_voucher` | Neuen Beleg inkl. Positionen anlegen |
| `book_voucher` | Beleg buchen / mit Banktransaktion verknüpfen |
| `get_voucher_positions` | Belegpositionen abrufen |
| `upload_voucher_file` | Belegdatei hochladen (liefert `filename` für `create_voucher`) |
| `get_bookkeeping_system_version` | Buchhaltungsversion (1.0 / 2.0) abfragen |
| `list_accounting_types` | Buchungskonten für Version 1.0 auflisten |
| `list_booking_accounts` | Buchungskonten inkl. erlaubter Steuerregeln (Version 2.0) |

#### Beleg anlegen und einer Transaktion zuordnen

1. `upload_voucher_file` → liefert `filename`. Immer `filePath` übergeben, wenn die Datei
   auf der Platte liegt – `base64Content` muss der Client Token für Token erzeugen und ist
   auf 256 KB begrenzt.
2. `create_voucher` mit `filename`, `positions` und Steuerangaben
3. `book_voucher` mit `checkAccountTransactionId` → verknüpft Beleg und Banktransaktion

Welche Steuer- und Kontofelder gelten, hängt von der Buchhaltungsversion ab
(`get_bookkeeping_system_version`): Version 1.0 nutzt `taxType` + `accountingTypeId`,
Version 2.0 nutzt `taxRuleId` + `accountDatevId`.

### Kontakt-Stammdaten

| Tool | Beschreibung |
|------|-------------|
| `list_communication_ways` / `get_communication_way` | E-Mail-Adressen, Telefonnummern und Webseiten von Kontakten |
| `create_communication_way` / `update_communication_way` | Kommunikationsweg anlegen / ändern |
| `list_communication_way_keys` | Schlüssel (geschäftlich, privat, ...) für `keyId` |
| `get_next_customer_number` / `check_customer_number_availability` | Kundennummern vergeben und prüfen |
| `find_contacts_by_custom_field_value` | Kontakte über ein benutzerdefiniertes Feld finden |
| `list_contact_custom_field_settings` / `create_...` / `update_...` | Definition benutzerdefinierter Kontaktfelder |
| `list_contact_custom_fields` / `set_contact_custom_field` / `update_contact_custom_field` | Werte benutzerdefinierter Kontaktfelder |
| `list_accounting_contacts` / `create_accounting_contact` / `update_accounting_contact` | Debitoren- und Kreditorennummern |

### Entwürfe: Rechnungen, Angebote, Gutschriften

Diese Tools legen **nur Entwürfe (Status 100)** an. Festschreiben, Versenden und Buchen
neuer Dokumente passiert bewusst nicht über den MCP-Server.

| Tool | Beschreibung |
|------|-------------|
| `create_invoice` | Rechnungsentwurf inkl. Positionen anlegen |
| `get_invoice_positions` / `list_invoice_positions` | Rechnungspositionen |
| `get_invoice_xml` / `get_invoice_partially_paid` | E-Rechnung (XML) / Teilzahlungsstatus |
| `create_invoice_reminder` | Mahnungsentwurf zu einer überfälligen Rechnung |
| `create_invoice_from_order` | Rechnungsentwurf aus einem Angebot (auch Teil-/Abschlagsrechnung) |
| `list_letterpapers` / `list_document_templates` | Briefpapiere und Dokumentvorlagen |
| `list_orders` / `get_order` / `get_order_positions` / `get_order_pdf` | Angebote, Auftragsbestätigungen, Lieferscheine lesen |
| `create_order` | Angebot (`AN`), Auftragsbestätigung (`AB`) oder Lieferschein (`LI`) als Entwurf |
| `list_credit_notes` / `get_credit_note` / `get_credit_note_pdf` / `list_credit_note_positions` | Gutschriften lesen |
| `create_credit_note` / `create_credit_note_from_invoice` | Gutschriftsentwurf anlegen |

`contactPersonId` ist die ID des sevdesk-Benutzers, der als Ansprechpartner eingetragen wird.

### Buchhaltung, Exporte und Berichte

| Tool | Beschreibung |
|------|-------------|
| `update_voucher` | Kopfdaten eines Beleg-Entwurfs ändern (kein Status, keine Positionen) |
| `get_receipt_guidance_for_account_number` / `get_receipt_guidance_for_tax_rule` | Erlaubte Steuerregeln bzw. Konten für Belegpositionen |
| `start_datev_csv_export` / `start_datev_xml_export` | DATEV-Export als ZIP starten (liefert Job-ID) |
| `get_export_progress` / `get_export_download_info` | Fortschritt und Download-Link eines Export-Jobs |
| `export_invoices_csv` / `export_credit_notes_csv` / `export_vouchers_csv` / `export_transactions_csv` / `export_contacts_csv` | Listen als CSV (Inhalt wird zurückgegeben) |
| `report_invoices` / `report_orders` / `report_vouchers` / `report_contacts` | Listenberichte (CSV bzw. PDF als Base64) |

DATEV-Exporte schreiben Belege **nie** fest (`enshrineDocuments` ist immer `false`). Vor dem
ersten DATEV-Export muss in sevdesk der Beginn des Geschäftsjahres gesetzt sein. CSV-Exporte
und Berichte sind auf 1 MB Antwortgröße begrenzt – mit Filtern oder `limit` einschränken.

### Bankkonten

| Tool | Beschreibung |
|------|-------------|
| `list_check_accounts` | Alle Bankkonten auflisten |
| `get_check_account` | Einzelnes Bankkonto abrufen |
| `get_check_account_balance` | Kontostand abrufen |
| `list_transactions` | Transaktionen auflisten |
| `get_transaction` | Einzelne Transaktion abrufen |
| `create_transaction` | Neue Transaktion erstellen |
| `update_transaction` | Noch nicht festgeschriebene Transaktion korrigieren (kein Status) |
| `create_check_account_file_import` | Bankkonto mit Dateiimport (CSV / MT940) anlegen |
| `create_check_account_clearing` | Verrechnungskonto anlegen |
| `update_check_account` | Bankkonto ändern |
| `list_private_transaction_rules` | Regeln für private Transaktionen auflisten |
| `create_private_transaction_rule` | Regel anlegen, die passende Transaktionen als privat markiert |

#### Abstimmung Bank ↔ Rechnung / Beleg

Transaktionen werden über `book_invoice` bzw. `book_voucher` mit
`checkAccountTransactionId` einer Rechnung oder einem Beleg zugeordnet. Festschreiben
und Löschen von Konten, Transaktionen und Regeln sind bewusst nicht enthalten.

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

## Lizenz

MIT
