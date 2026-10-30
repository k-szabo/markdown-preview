# Fejlesztői útmutató

## Projektfelépítés

- `index.html` – GitHub Pages belépési pontja
- `assets/css/styles.css` – alkalmazásstílusok és témák
- `assets/js/dependencies.js` – külső könyvtárak betöltése és témastílusok
- `assets/js/errorHandling.js` – közös könyvtár- és előnézeti hibamegjelenítés
- `assets/js/markdown.js` – Markdown-kiegészítők és kódblokkok feldolgozása
- `assets/js/renderer.js` – az előnézet, diagramok renderelése és az SVG-diagramok navigációja
- `assets/js/app.js` – felhasználói események és az alkalmazás indítása
- `docs/CHANGELOG.md` – kiadások változásnaplója

## Helyi fejlesztés

Az alkalmazás statikus, nincs buildlépése és nincs szükség csomagtelepítésre. A CDN-es könyvtárbetöltés miatt internetkapcsolat szükséges.

Az `index.html` böngészőben közvetlenül megnyitható. Ha helyi HTTP-szervert szeretnél használni:

```powershell
python -m http.server 8000
```

Ezután nyisd meg a `http://localhost:8000` címet.

## GitHub Pages publikálás

1. Töltsd fel a változtatásokat a GitHub-repozitóriumba.
2. A repozitórium **Settings → Pages** oldalán válaszd ki a publikálási forrást.
3. Állítsd be a `main` ágat és a gyökérkönyvtárat (`/`).

Az `index.html` a gyökérkönyvtárban marad, az eszközök és stílusok relatív útvonalakat használnak, így projektoldal-alútvonalon is működnek. További build- vagy deploy-konfiguráció nem kell.

## CDN-függőségek és integritás

A Marked és a DOMPurify induláskor töltődik be. A Mermaid, KaTeX, a lábjegyzet-kiegészítő, a szintaxiskiemelő, a Chart.js és a Graphviz csak használatkor töltődik le.

A CDN-címek rögzített verziót használnak, és a JavaScript-/CSS-erőforrásokat Subresource Integrity (SRI) védi. Függőségverzió frissítésekor ellenőrizd a hozzá tartozó `integrity` hash-t az `assets/js/dependencies.js` fájlban is.

## Verziózás

A projekt SemVer formátumú verziót használ (`MAJOR.MINOR.PATCH`). A megjelenített verziót az `index.html` `app-version` meta mezőjében frissítsd, a változásokat pedig a `docs/CHANGELOG.md` fájlban rögzítsd. A GitHub Pages az új verziót a `main` ágra történő feltöltés után jeleníti meg.

## Biztonsági megjegyzések

- A Markdown által generált HTML-t DOMPurify tisztítja.
- A Mermaid szigorú biztonsági módban, SVG-feliratokkal renderel.
- A CDN-erőforrásokat SRI ellenőrzi.
- A Markdown szöveg feldolgozása a böngészőben történik; külső képek és hivatkozások betöltésekor a böngésző a megadott címekhez kapcsolódhat.
