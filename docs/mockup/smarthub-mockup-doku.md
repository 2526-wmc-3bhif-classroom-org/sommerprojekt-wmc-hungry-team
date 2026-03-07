# Smart Dashboard Frontend – Dokumentation


## Übersicht - Funktionalität und Idee


Der SmartHub ist eine Web-App auf einem Raspberry Pi, die auf einem LCD-Panel über dem Nachttisch läuft.  
Die Hauptseite zeigt Uhrzeit, Datum, Wetter, Termine und Routeninformationen kompakt an.  

**Routinen** sind automatisierte Abläufe, die zu bestimmten Uhrzeiten aktiviert werden und ausgewählte Widgets einblenden – zum Beispiel Wetter, Termine oder Routenplanung.  
So kann man morgens automatisch die Route zur Arbeit, Busfahrpläne oder persönliche Termine sehen, ohne manuell etwas öffnen zu müssen.  

---

## Hauptbereiche der Seite

### Header
- Befindet sich oben auf der Seite.
- Zeigt die Überschrift „Daily Dashboard“. / "SmartHub"
- Enthält die aktuelle Uhrzeit, die live aktualisiert wird.

### Linke Widget-Spalte
1. **Uhrzeit & Datum**
   - Zeigt die aktuelle Uhrzeit und das aktuelle Datum.
   - Uhrzeit wird jede Sekunde aktualisiert.
   - Zeigt optional die eingestellte Weckerzeit.
2. **Wetter**
   - Zeigt aktuelle Wetterinformationen (Temperatur, Wind).
   - Kann über API dynamisch aktualisiert werden.
3. **Termine**
   - Zeigt Termine an, die aus dem Kalender (z.B. Google Calendar) geladen werden.
   - Zeigt Uhrzeit und Terminbeschreibung.

### Rechte Spalte - Map
- Zeigt eine LAndkarte auf der eine Route zu einem beliebigen Ziel angezeigt wird
- Darstellung von Teilstrecken mit langsamerem Verkehr und Stau, Baustellen etc.
- Ankunftszeit, Fahrtdauer und eventuelle Verspätung.

### BZW. Rechte Spalte – Route / Flowchart
- Zeigt eine Route als Flussdiagramm an (z.B. Bus, Tram, Auto).
- Darstellung von Haltestellen, Start-/Zielpunkten und Umstiegen.
- Enthält Routenstatistiken: Fahrzeit, Anzahl Umstiege, geplante Ankunft.
- Visualisierung:
  - Linie in der Mitte, Punkte für Stopps.
  - Umstiege als hervorgehobene Transfer-Punkte.



### Settings-Button
- Befindet sich unten links auf der Seite, erscheint nur beim Hovern in der Ecke.
- Klick öffnet das **Routinen-Übersicht-Popup**.



### Routinen-Übersicht-Popup
- Zeigt alle vorhandenen Routinen an.
- Jede Routine hat:
  - **Name & Uhrzeit**
  - **Löschen-Button** (blauer Mülleimer)
- Am unteren Ende: **+ Button**, öffnet das Konfigurations-Popup.



### Routinen-Konfigurations-Popup

- Zweispaltiges Layout:
  - **Linke Spalte:** Routine-Name, Checkboxen für Widgets (Uhrzeit & Datum, Wetter, Termine, Auto-Routen, Bus/Tram).
  - **Rechte Spalte:** Autoroute- oder Bus/Tram-Felder:
    - Autoroute: Startzeit, Startort, Ankunftsort.
    - Bus/Tram: Einstiegsort, Ausstiegsort, Abfahrtszeit.
- Speicherung:
  - Speichern-Button schließt das Popup.
  - Neue Routine kann zur Übersicht hinzugefügt werden.