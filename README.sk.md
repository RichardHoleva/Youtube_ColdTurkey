# YouTube Focus Lock 1.0.0

Rozšírenie pre Google Chrome na počítači (Manifest V3, Chrome 111 alebo novší).
V dennom intervale skryje domovský feed YouTube a odporúčania vedľa videa.
Vyhľadávanie, prehrávač, komentáre a ovládanie playlistu ostávajú dostupné.

## Inštalácia v Google Chrome

1. Rozbaľ ZIP do trvalého priečinka, napríklad Dokumenty/YouTube Focus Lock.
   Priečinok po inštalácii nepresúvaj ani nemaž.
2. Do adresného riadka Chrome napíš `chrome://extensions` a stlač Enter.
3. Zapni **Developer mode / Režim pre vývojárov**.
4. Klikni na **Load unpacked / Načítať rozbalené**.
5. Vyber rozbalený priečinok, v ktorom je priamo súbor `manifest.json`.
   Nevyberaj ZIP ani nadradený priečinok.
6. Cez ikonu skladačky pripni **YouTube Focus Lock** na panel prehliadača.
7. Obnov už otvorené karty YouTube. Nové karty budú fungovať automaticky.

Postup Google: [Load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Používanie

- Predvolený rozvrh je **každý deň 08:00–20:00** podľa miestneho času počítača.
  Ak rozšírenie nainštaluješ počas tohto intervalu, blokovanie aj zámok
  nastavení sa zapnú ihneď. Rozvrh potom upravíš po 20:00.
- Rozhranie rozšírenia je v angličtine. Mimo aktívneho intervalu (nadpis
  **Feed is open until HH:mm.**) klikni na ikonu rozšírenia, zadaj **From** a
  **To** v 24-hodinovom formáte HH:mm (napríklad `08:00`; skrátené `8`, `815`
  sa po opustení poľa doplnia) a klikni na **Save**. Ak nový rozvrh zahŕňa
  aktuálny čas, začne platiť ihneď a nastavenia sa zamknú.
- Časová os v popupe zobrazuje uložený interval ako čiernu líniu a aktuálny
  miestny čas ako oranžovú zvislú značku. Je len informatívna; časy sa menia
  v poliach **From** a **To**.
- Začiatok intervalu sa započítava, koniec už nie: pri 08:00–20:00 sa
  blokovanie zapne o 08:00 a vypne o 20:00.
- Funguje aj interval cez polnoc, napríklad **22:00–06:00**. Rovnaký začiatok
  a koniec nie sú povolené.
- Počas aktívneho intervalu (nadpis **No feed until HH:mm.**) popup zobrazí
  uložené časy ako obyčajný text a namiesto tlačidla **Save** ikonu zámku
  s textom **Locked**. Zámok kontroluje aj proces rozšírenia na pozadí. Ak
  interval začne počas úpravy a zmeny ešte nie sú uložené, zobrazí sa uložený
  rozvrh a koncept sa zahodí.
- Po skončení intervalu sa feed aj odporúčania automaticky vrátia a
  nastavenia sa odomknú. Rozvrh sa opakuje každý deň.
- Rozvrh prežije zatvorenie a opätovné spustenie prehliadača. Alarmy sa pri
  spustení obnovia a otvorené karty priebežne kontrolujú aktuálny čas,
  vrátane návratu po uspávaní. Prehliadač môže alarmy a časovače pri
  uspávaní alebo obmedzovaní kariet oneskoriť.

## Opera GX

Rozšírenie používa bežné rozhrania Chromium a je pripravené na vyskúšanie
v Opera GX. Kompatibilita s Opera GX tu nebola overená.

Otvor `opera://extensions`, zapni **Developer mode** a cez **Load unpacked**
vyber ten istý priečinok so súborom `manifest.json`. Potom pripni ikonu
rozšírenia a obnov už otvorené karty YouTube. Názvy tlačidiel sa môžu líšiť
podľa jazyka a verzie prehliadača.

## Rozsah a obmedzenia

- Funguje na desktopových stránkach `https://www.youtube.com` a
  `https://youtube.com`. Mobilný web, aplikácia YouTube, YouTube Music
  a vložené prehrávače na iných stránkach nie sú zahrnuté.
- Skrýva domovský feed a odporúčania na stránke prehrávania videa.
  Nie je to blokátor všetkých častí YouTube ani samostatný blokátor Shorts.
  Vyhľadávanie a ďalšie stránky, napríklad odbery či kanály, ostávajú dostupné.
- Táto verzia nebráni vypnutiu alebo odinštalovaniu rozšírenia v prehliadači,
  úprave jeho súborov ani zmene času počítača. Zámok nastavení slúži ako
  pomoc pri sústredení; nie je ochranou proti obchádzaniu.
- YouTube môže zmeniť štruktúru stránky. V takom prípade bude potrebné
  upraviť pravidlá skrývania. Iné rozšírenia môžu ovplyvniť výsledné zobrazenie.

## Údaje a oprávnenia

Rozvrh sa ukladá iba lokálne cez `chrome.storage.local`. Rozšírenie nemá
telemetriu, neposiela históriu ani vyhľadávanie na server a nepoužíva
externé knižnice či vzdialený kód. Samotná stránka YouTube sa pripája
k svojim službám bežným spôsobom.

Oprávnenie **storage** uchováva rozvrh; **alarms** plánuje jeho kontroly.
Prístup k stránkam je obmedzený na uvedené dve adresy YouTube.

Technická dokumentácia: [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
a [chrome.alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms).

## Keď sa feed neskryje

1. Obnov kartu YouTube po inštalácii alebo opätovnom načítaní rozšírenia.
2. V popup okne skontroluj uložené časy a nadpis **No feed until HH:mm.**.
3. V správcovi rozšírení skontroluj, že je rozšírenie zapnuté a má povolený
   prístup k YouTube. Prípadnú chybu rozšírenia nájdeš na tom istom mieste.
4. Ak problém trvá, over konflikt s ďalšími rozšíreniami upravujúcimi YouTube.
   Zmena vzhľadu YouTube môže vyžadovať aktualizáciu tejto verzie.

Pri aktualizácii súborov klikni pri rozšírení v správcovi rozšírení na
**Reload / Znova načítať** a obnov karty YouTube. Bežné opätovné načítanie
zachová uložený rozvrh; odinštalovanie jeho lokálne údaje odstráni.
