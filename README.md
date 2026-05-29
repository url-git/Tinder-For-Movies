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

## Architektura projektu

```
Tinder-For-Movies/
│
├── index.html                       # Cała struktura HTML aplikacji
│                                    # Zawiera 7 ekranów: landing, wybór gatunku,
│                                    # dołącz do sesji, oczekiwanie, swipowanie,
│                                    # dopasowanie, koniec listy
│
├── style.css                        # Wszystkie style aplikacji
│                                    # Ciemny motyw premium, animacje kart,
│                                    # efekty swipe w lewo/prawo, konfetti
│
├── script.js                        # Cała logika aplikacji (Vanilla JS)
│                                    # Zarządzanie sesją, pobieranie filmów,
│                                    # głosowanie, wykrywanie dopasowań,
│                                    # komunikacja z Supabase w czasie rzeczywistym
│
├── netlify/
│   └── functions/
│       ├── movies.js                # Funkcja serverless: proxy do TMDB API
│       │                            # Ukrywa klucz TMDB_API_KEY po stronie serwera
│       │                            # Dostępna pod: /api/movies?genre=28
│       │
│       └── config.js                # Funkcja serverless: serwuje klucze Supabase
│                                    # Frontend pobiera je przy starcie aplikacji
│                                    # Dostępna pod: /api/config
│
├── netlify.toml                     # Konfiguracja Netlify
│                                    # Ustawia katalog funkcji i przekierowania:
│                                    # /api/* → /.netlify/functions/*
│
├── server.js                        # Lokalny serwer dev (zastępuje netlify dev)
│                                    # Uruchom: node server.js → http://localhost:3000
│                                    # Wczytuje .env i obsługuje /api/config, /api/movies
│
├── supabase.sql                     # Schemat bazy danych do uruchomienia w Supabase
│                                    # Tworzy tabele: sessions, votes
│                                    # Konfiguruje RLS (bezpieczeństwo) i Realtime
│
├── .env.example                     # Szablon zmiennych środowiskowych
│                                    # Pokazuje jakich kluczy potrzebuje projekt
│                                    # Bezpieczny do commitowania — bez prawdziwych wartości
│
├── .env                             # Twoje lokalne klucze API (NIE w repo, w .gitignore)
│                                    # Tworzysz go sam na podstawie .env.example
│                                    # Używany tylko przy lokalnym uruchomieniu (netlify dev)
│
├── .gitignore                       # Lista plików pomijanych przez Git
│                                    # Chroni m.in. .env przed trafieniem do repo
│
└── README.md                        # Ten plik — dokumentacja projektu
```

### Jak przepływają dane

```
Przeglądarka
    │
    ├─► /api/config       → config.js (Netlify Function)
    │                              └─► zwraca SUPABASE_URL + SUPABASE_ANON_KEY z env vars
    │
    ├─► /api/movies       → movies.js (Netlify Function)
    │                              └─► odpytuje TMDB API kluczem TMDB_API_KEY z env vars
    │
    └─► Supabase (realtime)
                           └─► tabela sessions — lista filmów, liczba graczy
                           └─► tabela votes — głosy obu graczy, wykrywanie dopasowań
```

---

## Wymagane konta i klucze

Przed startem zarejestruj się i pobierz klucze z trzech serwisów:

| Serwis | Co pobrać | Gdzie |
|--------|-----------|-------|
| [themoviedb.org](https://www.themoviedb.org/settings/api) | API Key | Settings → API → Request an API Key |
| [supabase.com](https://supabase.com/dashboard) | Project URL + anon key | Project Settings → API |
| [netlify.com](https://app.netlify.com) | konto do deploymentu | — |

---

## Krok 1 – Supabase: utwórz bazę danych

1. Zaloguj się na [supabase.com/dashboard](https://supabase.com/dashboard) i utwórz nowy projekt.
2. W lewym menu kliknij **SQL Editor**.
3. Otwórz plik `supabase.sql` z tego repozytorium, skopiuj całą zawartość i wklej do edytora. Kliknij **Run**.
4. W tym samym SQL Editor uruchom osobno poniższy fragment — bez tego rola `anon` nie ma uprawnień do zapisu i odczytu tabel, co objawia się błędem `permission denied for table sessions`:

```sql
GRANT ALL ON TABLE sessions TO anon, authenticated;
GRANT ALL ON TABLE votes TO anon, authenticated;
```

5. Przejdź do **Project Settings → API** i skopiuj dwie wartości:
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
5. Kliknij **Deploy** i poczekaj na zakończenie pierwszego wdrożenia.

### 2b. Dodaj klucze API w ustawieniach projektu

Po zakończeniu deployu przejdź do:
**Project configuration → Environment variables → Add a variable**

Dodaj trzy zmienne, każdą oznacz jako **Secret** i kliknij **Save variable**:

**Zmienna 1**
- Key: `TMDB_API_KEY`
- Value: *(twój klucz z themoviedb.org)*

**Zmienna 2**
- Key: `SUPABASE_URL`
- Value: *(Project URL z Supabase, samo `https://abcdefgh.supabase.co` — bez `/rest/v1/` na końcu)*

**Zmienna 3**
- Key: `SUPABASE_ANON_KEY`
- Value: *(anon key z Supabase, zaczyna się od `eyJ...`)*

> Zmienne możesz też zaimportować zbiorczo przez **Import from .env file** —
> wklej zawartość swojego lokalnego pliku `.env`.

### 2c. Wyzwól ponowny deploy

Po zapisaniu wszystkich zmiennych aplikacja potrzebuje nowego deployu, żeby je załadować:

1. Przejdź do zakładki **Deploys**.
2. Kliknij **Trigger deploy → Deploy site**.
3. Poczekaj ~1–2 minuty. Aplikacja gotowa pod adresem `https://twoja-strona.netlify.app`.

---

## Uruchomienie lokalne

Do lokalnego testowania służy plik `server.js` — prosty serwer Node.js, który zastępuje
Netlify CLI. Nie wymaga żadnych dodatkowych zależności ani instalacji.

**Krok 1 — utwórz plik `.env`:**

```bash
cp .env.example .env
```

Otwórz `.env` i wpisz swoje klucze:

```
TMDB_API_KEY=tu_wklej_klucz_z_themoviedb
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Krok 2 — uruchom serwer:**

```bash
node server.js
```

Aplikacja dostępna pod adresem: **http://localhost:3000**

Serwer obsługuje:
- `/api/config` — zwraca klucze Supabase z `.env`
- `/api/movies` — proxy do TMDB API
- wszystkie pliki statyczne (HTML, CSS, JS)

> Pliki zaczynające się od kropki są domyślnie ukryte w macOS.
> W Finderze: **Cmd + Shift + .** przełącza ich widoczność.
