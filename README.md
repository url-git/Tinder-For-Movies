# CineMatch – Tinder dla filmów

Aplikacja webowa dla dwóch osób, które chcą razem wybrać film na wieczór.
Każdy z użytkowników przegląda karty filmowe i zaznacza „lubię" lub „nie lubię".
Gdy oboje polubią ten sam film — pojawia się ekran dopasowania i wiadomo, co oglądać.

Działa przez wspólny kod sesji: jedna osoba tworzy sesję i udostępnia 6-znakowy kod,
druga wpisuje go i od razu zaczyna swipować. Filmy pobierane są z TMDB według wybranego
gatunku (Akcja, Komedia, Horror itd.), kolejność jest identyczna dla obu graczy.
Synchronizacja w czasie rzeczywistym odbywa się przez Supabase.

Żadne klucze API nie są przechowywane w kodzie — wszystkie sekrety żyją wyłącznie
w zmiennych środowiskowych i nigdy nie trafiają do repozytorium.

---

## Wymagane konta i klucze

Przed startem zarejestruj się i pobierz klucze z trzech serwisów:

| Serwis | Co pobrać | Gdzie |
|--------|-----------|-------|
| [themoviedb.org](https://www.themoviedb.org/settings/api) | API Key | Settings → API → Request an API Key |
| [supabase.com](https://supabase.com/dashboard) | Project URL + anon key | Project Settings → API |
| [netlify.com](https://app.netlify.com) | konto do deploymentu | — |

Masz trzy klucze do zebrania. Będziesz je używał w krokach poniżej.

---

## Krok 1 – Supabase: utwórz bazę danych

1. Zaloguj się na [supabase.com/dashboard](https://supabase.com/dashboard) i utwórz nowy projekt.
2. W lewym menu kliknij **SQL Editor**.
3. Otwórz plik `supabase.sql` z tego repozytorium, zaznacz całą zawartość, skopiuj i wklej do edytora. Kliknij **Run**.
4. Przejdź do **Project Settings → API** i skopiuj dwie wartości — będą potrzebne w kroku 2:
   - **Project URL** (wygląda tak: `https://abcdefgh.supabase.co`)
   - **anon / public** key (długi ciąg zaczynający się od `eyJ...`)

---

## Krok 2 – Netlify: wdróż aplikację

### 2a. Połącz repozytorium z Netlify

1. Zaloguj się na [app.netlify.com](https://app.netlify.com).
2. Kliknij **Add new project → Import an existing project**.
3. Wybierz **GitHub** i wskaż repozytorium `Tinder-For-Movies`.
4. Ustaw parametry buildu:
   - **Base directory**: *(zostaw puste)*
   - **Build command**: *(zostaw puste)*
   - **Publish directory**: `.`
5. Kliknij **Deploy** — pierwsze wdrożenie zakończy się błędem braku kluczy, to normalne na tym etapie.

### 2b. Dodaj klucze API w panelu Netlify

Klucze wpisujesz bezpośrednio w panelu Netlify — **nie ma tu żadnych plików do edytowania**.
Netlify przekazuje je do funkcji serverless działających po stronie serwera.

1. W panelu projektu kliknij **Project configuration** w lewym menu
   *(w starszym UI może być: "Site configuration")*.
2. Wybierz **Environment variables** z podmenu.
3. Kliknij **Add a variable → Add a single variable**.
4. Dodaj trzy zmienne — dla każdej wypełnij formularz i kliknij **Save**:

**Zmienna 1**
- Key: `TMDB_API_KEY`
- Value: *(twój klucz z themoviedb.org)*
- Scopes: zaznacz **Functions** ✓

**Zmienna 2**
- Key: `SUPABASE_URL`
- Value: *(Project URL skopiowany z Supabase, np. `https://abcdefgh.supabase.co`)*
- Scopes: zaznacz **Functions** ✓

**Zmienna 3**
- Key: `SUPABASE_ANON_KEY`
- Value: *(anon key skopiowany z Supabase, zaczyna się od `eyJ...`)*
- Scopes: zaznacz **Functions** ✓

> **Dlaczego scope „Functions"?** Aplikacja używa funkcji serverless Netlify jako pośrednika
> do API — to one czytają klucze i odpytują TMDB/Supabase. Bez tego scope'u funkcja nie
> widzi zmiennej i zgłasza błąd.

### 2c. Wyzwól ponowny deploy

1. Przejdź do zakładki **Deploys**.
2. Kliknij **Trigger deploy → Deploy site**.
3. Poczekaj ~1–2 minuty na zakończenie.
4. Aplikacja gotowa pod adresem `https://twoja-strona.netlify.app`.

---

## Uruchomienie lokalne (opcjonalnie)

Jeśli chcesz testować aplikację na swoim komputerze zamiast przez Netlify, potrzebujesz
pliku `.env` — jest to lokalny odpowiednik zmiennych środowiskowych z panelu Netlify.

**Czym jest plik `.env`?**
To zwykły plik tekstowy z kluczami API, który istnieje tylko na Twoim komputerze.
Nie jest i nie będzie commitowany do repozytorium Git (jest w `.gitignore`).
Dlatego nie widzisz go w repo — każdy deweloper tworzy go sobie lokalnie sam.

**Jak go utworzyć:**

W repozytorium znajduje się plik `.env.example` — to gotowy szablon z pustymi wartościami.
Skopiuj go i nadaj kopii nazwę `.env`:

```bash
cp .env.example .env
```

Komenda `cp` to po prostu "kopiuj plik" — tworzy nowy plik `.env` na podstawie szablonu.

Następnie otwórz plik `.env` w edytorze (np. VS Code) i wpisz swoje klucze:

```
TMDB_API_KEY=tu_wklej_klucz_z_themoviedb
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Plik `.env` możesz też po prostu stworzyć ręcznie w edytorze — bez terminala.
Utwórz nowy plik, nazwij go `.env` (z kropką na początku), i wklej powyższy blok z uzupełnionymi wartościami.

**Uruchomienie:**

```bash
# Zainstaluj Netlify CLI (jednorazowo)
npm install -g netlify-cli
netlify login

# Uruchom lokalnie
netlify dev
```

Aplikacja dostępna pod `http://localhost:8888`.

> Jeśli nie widzisz pliku `.env` w Finderze ani edytorze — to dlatego, że pliki
> zaczynające się od kropki są domyślnie ukryte w macOS.
> W Finderze: **Cmd + Shift + .** (kropka) przełącza ich widoczność.
> W VS Code są widoczne normalnie w panelu plików po lewej stronie.
