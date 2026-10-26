# Automatické testy

Vyžadujú Node.js 22 alebo novší. Ďalšie balíčky nie sú potrebné.

V priečinku rozšírenia, ktorý obsahuje `manifest.json`, spusti:

```sh
node --test tests/*.test.cjs
```

Testy zahŕňajú aj pomocné funkcie časovej osi popupu (rozdelenie nočného intervalu o polnoci, formát HH:mm, zápis času z klávesnice) a anglické texty procesu na pozadí. Test pravidiel content.css hlieda, aby sa domovský feed a bočné odporúčania skrývali podľa toho, čím sú, nielen podľa aktuálnej adresy; inak by sa pri prechode na vyhľadávanie alebo kanál na chvíľu zobrazil starý feed.

Testy používajú pevne nastavený čas a simulované rozhranie Chrome. Overujú denný aj nočný interval, presné hranice, zmenu letného času v pásme Europe/Bratislava, validáciu, zamknutie rozvrhu, súbežné ukladanie, trvalé uloženie, alarmy, reštart a spracovanie chýb.

Tieto jednotkové testy nespúšťajú prehliadač ani živý YouTube. Overenie DOM, popupu a správania v prehliadači prebehlo samostatne; jeho rozsah uvádza priložená správa o testovaní.
