# Markdown Preview

Egyszerű, valós idejű Markdown előnézet két panellel, fejlett Markdown-kiegészítések támogatásával. Nincs szükség buildre vagy telepítésre; a projekt GitHub Pages-en statikus weboldalként publikálható.

## Futtatás

Nyisd meg az `index.html` fájlt böngészőben. Az összes könyvtár CDN-ről töltődik be, ezért internetkapcsolat szükséges. A Markdown tartalom feldolgozása és a diagramok renderelése a böngészőben történik.

## Támogatott elemek

- GitHub Flavored Markdown: táblázatok, áthúzás, automatikus linkek és feladatlisták
- Mermaid diagramok a `mermaid` kódblokkokban
- Graphviz DOT diagramok a `dot` vagy `graphviz` kódblokkokban
- Matematikai képletek KaTeX-szel: `$...$` soron belül, `$$...$$` külön sorban
- Lábjegyzetek a `[^jelölés]` és `[^jelölés]: magyarázat` formával
- Definíciós listák a kifejezés utáni `: meghatározás` sorral
- Szintaxiskiemelés a nyelvvel megjelölt kódblokkokban
- Vonal-, oszlop-, kör-, doughnut-, radar- és polar area grafikonok `chart` JSON blokkokban

Példák:

````markdown
Szorozzuk össze: $a^2 + b^2 = c^2$.

Itt egy lábjegyzet[^megjegyzes].

[^megjegyzes]: A lábjegyzet szövege.

Markdown
: Könnyű szövegleíró formátum.

```chart
{
  "type": "bar",
  "labels": ["Jan", "Feb", "Már"],
  "datasets": [
    { "label": "Eladások", "data": [12, 19, 8] }
  ]
}
```

```dot
digraph G {
  Markdown -> Előnézet
}
```
````

Mermaid diagramot a `mermaid` nyelvű kódblokkal adhatsz hozzá:

````markdown
```mermaid
flowchart LR
    A[Markdown] --> B[Előnézet]
```
````

## GitHub Pages

1. Töltsd fel a fájlokat egy GitHub-repozitóriumba.
2. A repozitórium **Settings → Pages** oldalán válaszd ki a publikálási forrást.
3. Állítsd be a `main` ágat és a gyökérkönyvtárat (`/`), majd mentsd el.

Az `index.html` és a hozzá tartozó fájlok a gyökérkönyvtárban vannak, így további build- vagy deploy-konfiguráció nem szükséges.
