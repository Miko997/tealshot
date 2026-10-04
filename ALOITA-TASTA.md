# Tealshot – aloita tästä

**Ctrl + Windows-näppäin + S → vedä alue → vapauta hiiri → 5 sekunnin ajastin → kuva leikepöydälle → Ctrl+V.**

Ajastin alkaa vasta, kun olet rajannut alueen. Odotuksen aikana voit käyttää sovelluksia normaalisti. Turkoosi kehys näyttää rajauksen. Kehys ja ajastin poistetaan ennen kuvan ottamista. Kuva otetaan siitä, mitä alueella näkyy AJASTIMEN LOPUSSA.

## Asennus

Tallenna ZIP Lataukset/Downloads-kansioon. Avaa terminaali:

```bash
cd "$(xdg-user-dir DOWNLOAD)"
unzip tealshot-0.1.0.zip
cd tealshot-0.1.0
bash install.sh
```

Vastaa `y`. Älä käytä sudoa.

Asentaja vapauttaa vanhan Flameshot/gnome-screenshot-pikanäppäimen Ctrl+Windows+S, jos se on käytössä, ja säilyttää siitä varmuuskopion. Clipboard Indicatorin Ctrl+Alt+V-yhdistelmää ei muuteta.

**Tallenna avoimet työsi ja kirjaudu ulos ja takaisin kerran.** Tavallinen uudelleenkäynnistys käy myös. Asentaja ei kirjaa sinua ulos automaattisesti.

Sen jälkeen paina **Ctrl + Windows-näppäin + S**.

## Asetukset

Extension Manager → Tealshot → rataskuvake. Tai:

```bash
gnome-extensions prefs tealshot@miko.local
```

- **Countdown:** ajastin 1–60 sekuntia.
- **Shortcut preset:** pikanäppäin.
- **Outline and timer color:** kehyksen väri, oletuksena hohtava turkoosinsininen `#23C9E8`.
- **Outline width:** viivan paksuus.
- **Subtle cyan glow:** hohto päälle/pois.
- **Copied confirmation:** lyhyt kopiointikuittaus päälle/pois.

## Käyttö

Rajauksen voi tehdä mihin tahansa vetosuuntaan. Rajaus ei seuraa ikkunaa, vaan pysyy samassa näytön kohdassa. Avaa siis haluamasi valikko, tooltip tai muu sisältö rajatun alueen SISÄLLE ajastimen aikana.

Peruuta rajaus Escillä tai oikealla hiiren painikkeella. Peruuta lähtölaskenta painamalla samaa screenshot-pikanäppäintä uudelleen.

Kuva kopioituu automaattisesti tavalliselle leikepöydälle. **Ctrl+V** liittää sen esimerkiksi kuvaa tukevaan chattiin. Clipboard Indicatorin historiaan tallentuminen edellyttää, että sen kuvahistoria on käytössä eikä yksityistila tai poissulku estä tallennusta. Tealshot ei muuta näitä asetuksia.

## Ensimmäisen testin tarkistus

Avaa selain. Rajaa siitä alue, vapauta hiiri ja avaa odotuksen aikana valikko alueen sisään. Liitä kuva. Siinä pitää näkyä vasta lähtölaskennan aikana avattu valikko – ei Tealshotin kehystä tai ajastinta.

## Tarvittaessa

Paikalliset diagnostiikkatiedot projektikansiosta:

```bash
bash doctor.sh
```

Pois käytöstä heti:

```bash
gnome-extensions disable tealshot@miko.local
```

Poistaminen projektikansiosta:

```bash
bash uninstall.sh
```

Poistaja palauttaa vanhan screenshot-pikanäppäimen, jos et ole muuttanut sen asetuksia asennuksen jälkeen.

**Testausraja:** ohjelmakoodin automaattitestit ja asetusskeeman käännös on ajettu. Natiivia GNOME 50 / NVIDIA / Wayland -työpöytätestiä ei ole voitu ajaa tässä kehitysympäristössä. Paketti on ensimmäinen paikallinen kehitysversio, ei väite sinun koneellasi jo todistetusta toiminnasta. Tallenna tärkeä työ ennen ensimmäistä kokeilua.
