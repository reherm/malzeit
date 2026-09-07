# Malzeit

Eine deutschsprachige, auf dem iPhone installierbare PWA für ein persönliches Malatelier. Alle Gemälde, Fotos, Sitzungen und Timer werden lokal in IndexedDB gespeichert. Kein App-Konto und kein Backend für Nutzerdaten.

## Funktionen

- Bilder mit Titel, Maßen, Technik und Status; Galerie mit Gesamtzeit.
- Ein dauerhafter Timer, Pause/Fortsetzen, Startkorrektur während des Laufens.
- Stoppen speichert sofort; anschließend lassen sich Beginn und Ende korrigieren. Pausen bleiben erhalten und werden auf den korrigierten Zeitraum begrenzt.
- Zeitnachträge als Beginn/Ende oder Datum und Stunden:Minuten. Alle Sitzungen sind bearbeitbar und löschbar.
- Kamera/Fotomediathek, Fortschrittsfotos mit Datum und Beschreibung, frei wählbares Titelbild.
- Wochen-, Monats- und Jahresstatistik mit Aufteilung von Sitzungen über Tagesgrenzen.
- Vollständiger JSON-Export und geprüfter, atomarer Import mit Fotos und aktivem Timer.
- Offline-Start nach einmaliger Online-Einrichtung; vollständiger, versionierter Cache der App-Dateien.

## Lokal starten

Node >=22.13, npm. `npm ci`, danach `npm run dev` für Entwicklung.

`npm run build` erzeugt die vollständige statische PWA in `dist/client`. `npm start` öffnet einen lokalen HTTP-Server auf Port 4173. Auf anderen Geräten muss die App über HTTPS bereitgestellt werden.

`npm test` prüft die Zeitlogik, Backup-Validierung und den erzeugten Offline-Worker (Build vorher ausführen). `npm run typecheck` und `npm run lint` prüfen den Quellcode. Die unverändert mitgelieferten UI-Komponenten sind vom Projekt-Lint ausgeschlossen. Lokale Fotodaten werden bewusst mit normalen `img`-Elementen angezeigt, ohne externen Bildoptimierungsdienst. Der zugängliche CSS-Chart verwendet eine zusammenhängende Textbeschreibung.

Der Windows-Build lässt Node nach dem CLI-Abschluss regulär auslaufen: Das verhindert den bekannten libuv-Absturz beim sofortigen `process.exit` nach HTTP-Prerendering. Fehlercodes bleiben erhalten. Siehe https://github.com/nodejs/node/issues/56645.

## Auf dem iPhone

Die veröffentlichte HTTPS-Adresse in Safari öffnen → Teilen → Zum Home-Bildschirm → falls angeboten „Als Web-App öffnen“ → Hinzufügen. Die installierte App einmal online öffnen und in den Einstellungen auf „Offline bereit“ achten. Danach funktionieren Start und Nutzung ohne Internet.

Apple-Anleitung: https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios

Möglichst von Anfang an die installierte App benutzen: Safari und die Home-Bildschirm-App können unterschiedliche Speicher verwenden. Bei Bedarf per Export/Import übertragen. Der Timer benutzt absolute Zeitstempel, keine dauerhaft im Hintergrund ausgeführte iOS-App. Ein manuell verstellter Gerätezeitpunkt kann die verstrichene Zeit verändern; Start und Ende sind korrigierbar.

## Sicherungen und Grenzen

Eine Sicherung vorbereiten, danach die Datei herunterladen oder über „Teilen“ in Dateien/iCloud Drive speichern. Der Download-Zeitpunkt ist ein Exportversuch; die Website kann nicht nachprüfen, ob die Datei tatsächlich im Dateisystem angekommen ist. Der Import zeigt den Inhalt vorab und ersetzt nach Bestätigung alle lokalen Daten. Während eines aktiven Timers ist er gesperrt. Version, Datentypen, Verweise und Bildformate werden geprüft. Fotos werden auf maximal 1.600 Pixel und JPEG verkleinert; das ist kein Originalfoto-Archiv. Export/Import sind auf 250 MB begrenzt.

Regelmäßige externe Sicherungen sind notwendig: Das Löschen der Website-Daten oder der App und Entscheidungen der iOS-Speicherverwaltung können lokale Daten entfernen. `navigator.storage.persist()` wird angefragt, soweit verfügbar. Eine PWA kann diese Entscheidung nicht garantieren.

## Hosting / GitHub

Die App kann vollständig statisch gehostet werden. Das Sites-Projekt wird über `.openai/hosting.json` verwaltet. Die bereitgestellte Sites-Adresse ist zunächst nur für den Eigentümer freigegeben; die Plattform kann zur Anmeldung auffordern. App-Daten bleiben unabhängig davon lokal.

Für GitHub Pages den Code in ein eigenes Repository hochladen, unter Settings → Pages „GitHub Actions“ auswählen und den manuell auslösbaren Workflow starten. Es wird nur der App-Code veröffentlicht, niemals die im Browser gespeicherten Bilder. `MALZEIT_BASE_PATH` wird beim GitHub-Build auf den Repository-Pfad gesetzt. Für eine eigene Domain oder ein `name.github.io`-Repository bleibt es leer. Ein Wechsel der Adresse benötigt einen Backup-Transfer, da Gerätespeicher an die Herkunft der App gebunden ist.

## Prüfstand

Automatisierte Tests prüfen mehrtägige Timer, Pausen, nachträgliche Korrekturen, Datumsgrenzen, Sicherungen und Offline-Caching in einer Service-Worker-Testumgebung. Noch nicht auf einem echten iPhone geprüft: Kameraauswahl, iOS-Dateidialog, Installation und Offline-Start im Flugmodus. Vor produktivem Einsatz einmal einen vollständigen Export/Import mit Testbild und einen Offline-Neustart durchführen.

Optionaler WebMCP-Zugriff bietet `list_paintings` und `start_painting_timer` über dieselben Datenaktionen. Ohne unterstützte Browser-API bleibt dieser Zusatz inaktiv; ein echter WebMCP-Vertragstest war in der verfügbaren Umgebung nicht möglich.
