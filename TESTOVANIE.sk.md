# Overenie YouTube Focus Lock 1.0.0

Dátum: 25. 10. 2026. Testovací prehliadač: Chromium 149.0.7827.55, Windows.
Opera GX ani značkový Google Chrome neboli v tomto teste použité. Rozšírenie
je určené pre desktopový Google Chrome s Manifest V3; Opera GX je neoverená
možnosť použitia cez rovnaké rozhrania Chromium.

## Automatizované testy pravidiel a procesu na pozadí

**17 testov prešlo, 0 zlyhalo.** Prenosné zdrojové testy a príkaz na spustenie
sú v priečinku `tests/`. Zahŕňajú začiatok/koniec intervalu, polnoc, zmenu
letného času vrátane zopakovanej hodiny, opravu neplatných nastavení,
zamknutie pri ukladaní zo starého popupu, súbežné ukladanie, uloženie a
opätovný štart, alarm po oneskorenom prebudení aj chyby úložiska.

## Testy v skutočnom prehliadači s načítaným rozšírením

**17 kontrol prešlo.** Rozšírenie bolo načítané z priečinka ako
Manifest V3 rozšírenie v samostatnom testovacom profile. Overené boli:

- Načítanie popupu a service workera; skutočné `chrome.storage.local` a dva alarmy.
- Zamknuté časové polia a ukladanie počas aktívneho intervalu, vrátane odmietnutia procesu na pozadí.
- Skrytý home feed, zachované vyhľadávanie, prehrávanie testovacieho videa,
  komentáre a playlist; dynamicky vložené odporúčania a dve rozloženia stránky videa.
- SPA navigácia, udalosť histórie, dostupné odbery a kanály a obnovenie obsahu mimo intervalu.
- Neplatné rovnaké časy, uloženie cez popup, obnovenie uložených časov pri zamknutí konceptu.
- Skutočné časovače content skriptu pri simulovanom plynúcom miestnom čase:
  automatické zapnutie aj vypnutie na hranici intervalu bez ďalšej navigácie.
- Miestny čas po návrate do karty, rozvrh zachovaný po reštarte prehliadača a obnovené alarmy.
- Svetlý a tmavý vzhľad popupu; výška 563 px pri šírke 360 px.

Väčšina DOM scenárov bola overená na kontrolovaných testovacích stránkach
pod adresou YouTube. Tieto stránky používajú reprezentatívne komponenty
YouTube a skutočne načítané content skripty rozšírenia. Prehrávanie v tomto
teste používalo lokálny testovací video stream.

## Živý YouTube

- Skutočný domovský rich grid YouTube: skrytý počas aktívneho intervalu.
- Skutočné vyhľadávanie YouTube: výsledky zostali dostupné počas aktívneho intervalu.
- Skutočná stránka videa po SPA prechode: odporúčania boli skryté a prehrávač zostal viditeľný.
- Skutočné video YouTube sa po kliknutí spustilo počas skrytých odporúčaní.

Testy nemôžu zaručiť kompatibilitu so všetkými experimentmi vzhľadu YouTube
ani s budúcimi zmenami jeho stránky. Bežné oneskorenia alarmov a časovačov
pri uspávaní rieši opakovaná kontrola aktuálneho času.
